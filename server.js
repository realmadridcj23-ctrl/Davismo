require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { CATEGORIES, normalize, referenceNames } = require('./gameData');
const { FIXED_QUESTIONS, buildDynamicQuestions, shuffle } = require('./triviaData');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');

app.use(express.json());
app.use(express.static(PUBLIC_DIR));

// ==================== IA (Google Gemini) ====================
// Necesita la variable de entorno GEMINI_API_KEY. Conseguí una clave GRATIS en
// https://aistudio.google.com/ (botón "Get API Key") y ponela en un archivo .env
// (mirá .env.example) o como variable de entorno de tu hosting.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';

function aiAvailable() {
  return !!GEMINI_API_KEY;
}

async function callClaude({ system, messages, maxTokens }) {
  if (!aiAvailable()) {
    const err = new Error('GEMINI_API_KEY no configurada');
    err.code = 'NO_API_KEY';
    throw err;
  }

  // Gemini no tiene un rol "system" separado como Anthropic: lo mandamos
  // como una instrucción aparte (systemInstruction) y convertimos los
  // mensajes de "user"/"assistant" al formato de Gemini ("user"/"model").
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/' +
    GEMINI_MODEL +
    ':generateContent?key=' +
    GEMINI_API_KEY;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { maxOutputTokens: maxTokens || 400 }
    })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error('Gemini API error ' + res.status + ': ' + text);
    err.code = 'API_ERROR';
    throw err;
  }

  const data = await res.json();
  const text = (data.candidates || [])
    .flatMap(c => (c.content && c.content.parts) || [])
    .map(p => p.text || '')
    .join('\n')
    .trim();
  return text;
}

// ==================== VERIFICACIÓN DE RESPUESTAS DEL MENTIROSO ====================
// Ya NO usa IA: es un chequeo instantáneo y exacto contra la lista oficial de
// cada categoría (gameData.js), con sus alias/apodos ya cargados ahí. Esto la
// hace más rápida y más precisa que depender de un modelo externo.

// ---- Verificación de una respuesta contra UNA categoría puntual ----
function verifyAnswerInCategory(query, categoryKey) {
  const cat = CATEGORIES[categoryKey];
  if (!cat) return { valid: false, display: null, reason: 'Esa categoría no existe.' };

  const qNorm = normalize(query);
  if (!qNorm) return { valid: false, display: null, reason: 'Escribí un nombre.' };

  const found = cat.items.find(item => item.aliases.some(a => normalize(a) === qNorm));
  if (found) {
    return { valid: true, display: found.display, reason: 'Coincide con la lista oficial de la categoría.' };
  }
  return { valid: false, display: null, reason: 'No es una respuesta válida para esta categoría.' };
}

// ---- Verificación contra TODAS las categorías (para el asistente) ----
function verifyAnswerAllCategories(query) {
  return Object.keys(CATEGORIES)
    .map(key => ({ key, result: verifyAnswerInCategory(query, key) }))
    .filter(r => r.result.valid)
    .map(r => ({ categoryKey: r.key, categoryLabel: CATEGORIES[r.key].label, display: r.result.display }));
}

// ==================== REGISTRO ====================
function readUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}
function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}
function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
function isValidUsername(v) {
  return /^[a-zA-Z0-9_-]{3,20}$/.test(v);
}

app.post('/api/registro', (req, res) => {
  const body = req.body || {};
  const username = (body.username || '').toString().trim();
  const email = (body.email || '').toString().trim();

  if (!isValidUsername(username)) {
    return res.status(400).json({
      ok: false,
      field: 'username',
      error: 'El usuario debe tener 3-20 caracteres (letras, números, guiones o guion bajo).'
    });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ ok: false, field: 'email', error: 'Ingresá un correo válido.' });
  }

  const users = readUsers();
  if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(409).json({
      ok: false,
      field: 'username',
      error: 'Ese nombre de usuario ya está registrado. Elegí otro.'
    });
  }
  if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ ok: false, field: 'email', error: 'Ese correo ya está registrado.' });
  }

  users.push({ username, email, createdAt: new Date().toISOString() });
  writeUsers(users);
  res.json({ ok: true, username });
});

app.get('/api/miembros', (req, res) => {
  const users = readUsers();
  res.json({ members: users.map(u => u.username) });
});

// ==================== TRIVIA NIVEL LEYENDA ====================
// No usa IA: es un banco propio de preguntas (fijas + generadas a partir de
// las categorías del Mentiroso) que se mezcla al azar en cada pedido, así
// que cada partida sale distinta y responde al instante.
app.get('/api/trivia/preguntas', (req, res) => {
  let count = parseInt(req.query.count, 10);
  if (isNaN(count)) count = 10;

  const pool = FIXED_QUESTIONS.concat(buildDynamicQuestions(CATEGORIES));
  count = Math.max(1, Math.min(pool.length, count));

  const questions = shuffle(pool)
    .slice(0, count)
    .map(item => {
      // Mezclamos también el orden de las opciones de cada pregunta.
      const tagged = item.options.map((opt, idx) => ({ opt, correct: idx === item.correctIndex }));
      const shuffledOptions = shuffle(tagged);
      return {
        question: item.question,
        options: shuffledOptions.map(o => o.opt),
        correctIndex: shuffledOptions.findIndex(o => o.correct)
      };
    });

  res.json({ questions, total: pool.length });
});

// ==================== ASISTENTE (IA de davismo) ====================
function categoriesMeta() {
  return Object.keys(CATEGORIES).map(key => {
    const c = CATEGORIES[key];
    return { key, label: c.label, short: c.short, hint: c.hint, count: c.items.length };
  });
}

app.get('/api/categorias', (req, res) => {
  res.json({ categories: categoriesMeta() });
});

// Verificación de una respuesta contra una categoría (o todas), local e instantánea.
// La usan: 1) el botón "Asistente" para consultar una respuesta suelta,
//          2) el modo LOCAL del Mentiroso (mismo dispositivo) para validar en vivo.
app.post('/api/asistente/verificar', (req, res) => {
  const body = req.body || {};
  const query = (body.query || '').toString().trim();
  const categoryKey = (body.categoryKey || '').toString().trim();

  if (!query) {
    return res.status(400).json({ ok: false, error: 'Escribí un nombre para verificar.' });
  }
  if (categoryKey && !CATEGORIES[categoryKey]) {
    return res.status(400).json({ ok: false, error: 'Esa categoría no existe.' });
  }

  if (categoryKey) {
    const result = verifyAnswerInCategory(query, categoryKey);
    const matches = result.valid
      ? [{ categoryKey, categoryLabel: CATEGORIES[categoryKey].label, display: result.display }]
      : [];
    return res.json({ ok: true, query, valid: result.valid, matches, reason: result.reason });
  }
  const matches = verifyAnswerAllCategories(query);
  return res.json({ ok: true, query, valid: matches.length > 0, matches });
});

// Asistente de IA general de davismo: se le puede preguntar cualquier cosa.
app.post('/api/asistente/chat', async (req, res) => {
  const body = req.body || {};
  const message = (body.message || '').toString().trim();
  const history = Array.isArray(body.history) ? body.history.slice(-12) : [];

  if (!message) {
    return res.status(400).json({ ok: false, error: 'Escribí algo para preguntarme.' });
  }
  if (!aiAvailable()) {
    return res.status(503).json({
      ok: false,
      error:
        'El asistente de chat todavía no está configurado en el servidor. Definí la variable de entorno GEMINI_API_KEY (ver .env.example) y reiniciá el servidor.'
    });
  }

  const system =
    'Sos el Asistente de IA de davismo, la comunidad y el sitio de fútbol de "davismo". ' +
    'Respondé en español neutro, formal y claro, sin modismos regionales ni jerga de ningún país ' +
    '(nada de voseo marcado, "che", "boludo", etc.), salvo que el usuario te pida explícitamente ' +
    'adoptar otro tono o dialecto. ' +
    'Podés responder cualquier pregunta (de fútbol, del sitio, o de cualquier otro tema en general), ' +
    'ayudar a explicar cómo se juega el "Mentiroso Futbolero" (el juego de la casa: se apuesta cuántos ' +
    'nombres se pueden decir de una categoría futbolera, y si te cantan "mentiroso" tenés que nombrarlos ' +
    'todos sin repetir antes de que se acabe el tiempo), o simplemente charlar. Respuestas concisas ' +
    '(un par de párrafos como mucho salvo que pidan algo más largo). No inventes datos de fútbol que no ' +
    'sepas con certeza; si no estás seguro, decilo.';

  const messages = history
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && m.content)
    .map(m => ({ role: m.role, content: String(m.content).slice(0, 2000) }));
  messages.push({ role: 'user', content: message });

  try {
    const reply = await callClaude({ system, messages, maxTokens: 700 });
    return res.json({ ok: true, reply });
  } catch (e) {
    console.error('Error en el asistente de chat:', e);
    return res.status(502).json({
      ok: false,
      error: 'No me pude conectar con la IA en este momento. Probá de nuevo en unos segundos.'
    });
  }
});

// ==================== MENTIROSO ONLINE ====================
const rooms = new Map(); // code -> room

// Tope técnico para el input de apuesta (no el máximo real de la categoría:
// a propósito se puede apostar por encima de lo que existe de verdad, y
// si te pasás, el tiempo te termina ganando la partida).
const HARD_MAX_BID = 999;

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function poolSize(room) {
  return CATEGORIES[room.categoryKey].items.length;
}

function publicState(room) {
  return {
    code: room.code,
    screen: room.screen,
    players: room.players.map(p => (p ? p.name : null)),
    connected: room.players.map(p => !!(p && p.connected)),
    categoryKey: room.categoryKey,
    category: room.categoryKey
      ? {
          label: CATEGORIES[room.categoryKey].label,
          short: CATEGORIES[room.categoryKey].short,
          hint: CATEGORIES[room.categoryKey].hint,
          count: poolSize(room)
        }
      : null,
    categoriesMeta: categoriesMeta(),
    timeLimit: room.timeLimit,
    starter: room.starter,
    turn: room.turn,
    bid: room.bid,
    bidder: room.bidder,
    answersGiven: room.answersGiven,
    timeLeft: room.timeLeft,
    scores: room.scores,
    failReason: room.failReason,
    lastBadAnswer: room.lastBadAnswer,
    lastSuccess: room.lastSuccess,
    roundsPlayed: room.roundsPlayed,
    pendingCheck: !!room.pendingCheck
  };
}

function broadcast(room) {
  io.to(room.code).emit('mentiroso:state', publicState(room));
}

function stopTimer(room) {
  if (room.timerId) {
    clearInterval(room.timerId);
    room.timerId = null;
  }
}

function startRound(room) {
  room.turn = room.starter;
  room.bid = 0;
  room.bidder = null;
  room.acceptedNormalized = [];
  room.answersGiven = [];
  room.failReason = '';
  room.pendingCheck = false;
  room.screen = 'bid';
  broadcast(room);
}

function startChallenge(room) {
  room.screen = 'challenge';
  room.timeLeft = room.timeLimit;
  room.answersGiven = [];
  room.acceptedNormalized = [];
  room.failReason = '';
  room.pendingCheck = false;
  stopTimer(room);
  broadcast(room);
  room.timerId = setInterval(() => {
    room.timeLeft -= 1;
    if (room.timeLeft <= 0) {
      stopTimer(room);
      finishChallenge(room, false, 'tiempo');
      return;
    }
    io.to(room.code).emit('mentiroso:tick', { timeLeft: room.timeLeft });
  }, 1000);
}

function finishChallenge(room, success, reason, badAnswer) {
  room.roundsPlayed++;
  if (success) {
    room.scores[room.bidder]++;
  } else {
    const challenger = room.bidder === 0 ? 1 : 0;
    room.scores[challenger]++;
  }
  room.failReason = reason || '';
  room.lastBadAnswer = badAnswer || '';
  room.lastSuccess = success;
  room.pendingCheck = false;
  room.screen = 'result';
  room.starter = room.starter === 0 ? 1 : 0;
  broadcast(room);
}

function destroyRoom(code) {
  const room = rooms.get(code);
  if (!room) return;
  stopTimer(room);
  rooms.delete(code);
}

io.on('connection', socket => {
  socket.on('mentiroso:create', (payload, cb) => {
    const name = ((payload && payload.playerName) || 'Jugador 1').toString().trim().slice(0, 18) || 'Jugador 1';
    const code = genCode();
    const room = {
      code,
      players: [{ id: socket.id, name, connected: true }, null],
      screen: 'lobby',
      categoryKey: null,
      timeLimit: 45,
      starter: 0,
      turn: 0,
      bid: 0,
      bidder: null,
      acceptedNormalized: [],
      answersGiven: [],
      timeLeft: 0,
      timerId: null,
      pendingCheck: false,
      scores: [0, 0],
      failReason: '',
      lastBadAnswer: '',
      lastSuccess: false,
      roundsPlayed: 0
    };
    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.playerIndex = 0;
    if (typeof cb === 'function') cb({ ok: true, code, playerIndex: 0 });
    broadcast(room);
  });

  socket.on('mentiroso:join', (payload, cb) => {
    const code = ((payload && payload.code) || '').toString().trim().toUpperCase();
    const name = ((payload && payload.playerName) || 'Jugador 2').toString().trim().slice(0, 18) || 'Jugador 2';
    const room = rooms.get(code);
    if (!room) {
      if (typeof cb === 'function') cb({ ok: false, error: 'No existe una sala con ese código.' });
      return;
    }
    if (room.players[1] && room.players[1].connected) {
      if (typeof cb === 'function') cb({ ok: false, error: 'Esa sala ya está completa.' });
      return;
    }
    room.players[1] = { id: socket.id, name, connected: true };
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.playerIndex = 1;
    room.screen = 'setup';
    if (typeof cb === 'function') cb({ ok: true, code, playerIndex: 1 });
    broadcast(room);
  });

  function getRoom() {
    const code = socket.data.roomCode;
    if (!code) return null;
    return rooms.get(code) || null;
  }

  socket.on('mentiroso:setup', payload => {
    const room = getRoom();
    if (!room || socket.data.playerIndex !== 0) return;
    if (room.players.filter(Boolean).length < 2) return;
    const key = payload && payload.categoryKey;
    if (!CATEGORIES[key]) return;
    let t = parseInt(payload && payload.timeLimit, 10);
    if (isNaN(t)) t = 45;
    t = Math.max(10, Math.min(180, t));
    room.categoryKey = key;
    room.timeLimit = t;
    room.scores = [0, 0];
    room.starter = 0;
    startRound(room);
  });

  socket.on('mentiroso:bid', payload => {
    const room = getRoom();
    if (!room || room.screen !== 'bid') return;
    if (socket.data.playerIndex !== room.turn) return;
    const isFirstBid = room.bid === 0;
    const min = isFirstBid ? 1 : room.bid + 1;
    const max = HARD_MAX_BID; // tope técnico, no el máximo real de la categoría a propósito
    const val = parseInt(payload && payload.value, 10);
    if (isNaN(val) || val < min || val > max) return;
    room.bid = val;
    room.bidder = room.turn;
    room.turn = room.turn === 0 ? 1 : 0;
    broadcast(room);
  });

  socket.on('mentiroso:challenge', () => {
    const room = getRoom();
    if (!room || room.screen !== 'bid') return;
    if (room.bid === 0) return;
    if (socket.data.playerIndex !== room.turn) return;
    startChallenge(room);
  });

  // La verificación ahora es instantánea (chequeo local contra la lista real
  // de la categoría), por eso este handler ya no necesita ser async ni avisar
  // "pendingCheck" mientras espera una respuesta externa.
  socket.on('mentiroso:answer', payload => {
    const room = getRoom();
    if (!room || room.screen !== 'challenge') return;
    if (socket.data.playerIndex !== room.bidder) return;

    const raw = ((payload && payload.text) || '').toString();
    if (!raw.trim()) return;

    const result = verifyAnswerInCategory(raw, room.categoryKey);

    if (!result.valid) {
      stopTimer(room);
      finishChallenge(room, false, 'invalido', raw);
      return;
    }

    const canonicalNorm = normalize(result.display);
    if (room.acceptedNormalized.includes(canonicalNorm)) {
      stopTimer(room);
      finishChallenge(room, false, 'duplicado', raw);
      return;
    }

    room.acceptedNormalized.push(canonicalNorm);
    room.answersGiven.push(result.display);

    if (room.answersGiven.length >= room.bid) {
      stopTimer(room);
      finishChallenge(room, true);
      return;
    }

    broadcast(room);
  });

  socket.on('mentiroso:nextRound', () => {
    const room = getRoom();
    if (!room || room.screen !== 'result') return;
    if (socket.data.playerIndex !== 0) return;
    startRound(room);
  });

  socket.on('mentiroso:changeCategory', () => {
    const room = getRoom();
    if (!room || room.screen !== 'result') return;
    if (socket.data.playerIndex !== 0) return;
    room.screen = 'setup';
    broadcast(room);
  });

  socket.on('mentiroso:leave', () => leaveRoom());
  socket.on('disconnect', () => leaveRoom());

  function leaveRoom() {
    const room = getRoom();
    if (!room) return;
    const idx = socket.data.playerIndex;
    if (room.players[idx]) room.players[idx].connected = false;
    io.to(room.code).emit('mentiroso:peer-left', { playerIndex: idx });
    stopTimer(room);
    broadcast(room);
    const stillConnected = room.players.some(p => p && p.connected);
    if (!stillConnected) {
      setTimeout(() => {
        const r = rooms.get(room.code);
        if (r && !r.players.some(p => p && p.connected)) destroyRoom(room.code);
      }, 5000);
    }
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('davismo corriendo en http://localhost:' + PORT);
  if (!aiAvailable()) {
    console.warn(
      '⚠️  GEMINI_API_KEY no está configurada: el Asistente de IA y la verificación ' +
        'de respuestas del Mentiroso no van a funcionar hasta que la definas (ver .env.example).'
    );
  }
});
