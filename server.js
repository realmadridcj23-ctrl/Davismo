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
const APPEALS_FILE = path.join(DATA_DIR, 'apelaciones.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');
if (!fs.existsSync(APPEALS_FILE)) fs.writeFileSync(APPEALS_FILE, '[]');

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

// ==================== APELACIONES DE BANEO ====================
// Formulario público (cualquiera puede enviar una apelación) + panel privado
// solo para el dueño del sitio (protegido con la variable de entorno ADMIN_KEY).
function readAppeals() {
  try {
    return JSON.parse(fs.readFileSync(APPEALS_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}
function writeAppeals(list) {
  fs.writeFileSync(APPEALS_FILE, JSON.stringify(list, null, 2));
}

// Envío público de una apelación.
app.post('/api/apelaciones', (req, res) => {
  const body = req.body || {};
  const discordUser = (body.discordUser || '').toString().trim().slice(0, 60);
  const banReason = (body.banReason || '').toString().trim().slice(0, 800);
  const appealText = (body.appealText || '').toString().trim().slice(0, 3000);
  const contact = (body.contact || '').toString().trim().slice(0, 120);

  if (!discordUser || !banReason || !appealText) {
    return res.status(400).json({ ok: false, error: 'Completá tu usuario de Discord, por qué te banearon y tu apelación.' });
  }

  const list = readAppeals();
  const appeal = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    discordUser,
    contact,
    banReason,
    appealText,
    status: 'pendiente',
    createdAt: new Date().toISOString()
  };
  list.unshift(appeal);
  writeAppeals(list);
  res.json({ ok: true, id: appeal.id });
});

// Todo lo de acá abajo es solo para el dueño del sitio: requiere la clave
// ADMIN_KEY (variable de entorno), que solo vos conocés.
function checkAdminKey(req, res) {
  if (!process.env.ADMIN_KEY) {
    res.status(503).json({
      ok: false,
      error: 'El panel de admin todavía no está configurado en el servidor. Definí la variable de entorno ADMIN_KEY.'
    });
    return false;
  }
  const key = req.headers['x-admin-key'] || (req.body && req.body.key) || (req.query && req.query.key) || '';
  if (key !== process.env.ADMIN_KEY) {
    res.status(401).json({ ok: false, error: 'Clave de admin incorrecta.' });
    return false;
  }
  return true;
}

// El panel llama primero acá solo para validar la clave sin traer todavía la lista.
app.post('/api/admin/login', (req, res) => {
  if (!checkAdminKey(req, res)) return;
  res.json({ ok: true });
});

app.get('/api/apelaciones', (req, res) => {
  if (!checkAdminKey(req, res)) return;
  const list = readAppeals();
  res.json({ ok: true, appeals: list });
});

app.post('/api/apelaciones/:id/estado', (req, res) => {
  if (!checkAdminKey(req, res)) return;
  const { id } = req.params;
  const status = (req.body && req.body.status) || 'pendiente';
  const list = readAppeals();
  const item = list.find(a => a.id === id);
  if (!item) return res.status(404).json({ ok: false, error: 'No se encontró esa apelación.' });
  item.status = status;
  writeAppeals(list);
  res.json({ ok: true });
});

app.delete('/api/apelaciones/:id', (req, res) => {
  if (!checkAdminKey(req, res)) return;
  const { id } = req.params;
  const list = readAppeals().filter(a => a.id !== id);
  writeAppeals(list);
  res.json({ ok: true });
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

// ==================== IMPOSTOR FUTBOLERO (online, mínimo 4 jugadores) ====================
const impostorRooms = new Map(); // code -> room

const IMPOSTOR_MIN_PLAYERS = 4;
const IMPOSTOR_MAX_PLAYERS = 10;

// Palabras extra, además de los jugadores/selecciones/clubes que ya usa el
// Mentiroso (así el banco es bien grande y bien futbolero).
const IMPOSTOR_EXTRA_WORDS = [
  { category: 'Términos', word: 'Offside' },
  { category: 'Términos', word: 'Tarjeta roja' },
  { category: 'Términos', word: 'Penal' },
  { category: 'Términos', word: 'Córner' },
  { category: 'Términos', word: 'Hat-trick' },
  { category: 'Términos', word: 'Chilena' },
  { category: 'Términos', word: 'Caño' },
  { category: 'Términos', word: 'Túnel' },
  { category: 'Términos', word: 'Barrida' },
  { category: 'Términos', word: 'Palomita' },
  { category: 'Términos', word: 'Tiro libre' },
  { category: 'Términos', word: 'Arquero' },
  { category: 'Términos', word: 'Lateral' },
  { category: 'Términos', word: 'Doble cinco' },
  { category: 'Jugadas históricas', word: 'La Mano de Dios' },
  { category: 'Jugadas históricas', word: 'El Gol del Siglo' },
  { category: 'Jugadas históricas', word: 'El Maracanazo' },
  { category: 'Estadios', word: 'Camp Nou' },
  { category: 'Estadios', word: 'Santiago Bernabéu' },
  { category: 'Estadios', word: 'Maracaná' },
  { category: 'Estadios', word: 'La Bombonera' },
  { category: 'Estadios', word: 'Monumental' },
  { category: 'Estadios', word: 'San Siro' }
];

function buildImpostorWordBank() {
  const bank = [];
  Object.keys(CATEGORIES).forEach(key => {
    const cat = CATEGORIES[key];
    cat.items.forEach(item => bank.push({ category: cat.label, word: item.display }));
  });
  return bank.concat(IMPOSTOR_EXTRA_WORDS);
}
const IMPOSTOR_WORD_BANK = buildImpostorWordBank();

function genImpostorCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (impostorRooms.has(code));
  return code;
}

function connectedImpostorPlayers(room) {
  return room.players.filter(p => p.connected);
}

function impostorPublicState(room) {
  const base = {
    code: room.code,
    screen: room.screen,
    hostId: room.hostId,
    minPlayers: IMPOSTOR_MIN_PLAYERS,
    maxPlayers: IMPOSTOR_MAX_PLAYERS,
    round: room.round,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      connected: p.connected,
      voted: room.screen === 'voting' ? !!p.voteFor : false
    })),
    chat: room.chat.slice(-200)
  };
  if (room.screen === 'results') {
    const tally = {};
    room.players.forEach(p => {
      if (p.voteFor) tally[p.voteFor] = (tally[p.voteFor] || 0) + 1;
    });
    let topId = null;
    let topCount = -1;
    let tie = false;
    Object.keys(tally).forEach(id => {
      if (tally[id] > topCount) {
        topCount = tally[id];
        topId = id;
        tie = false;
      } else if (tally[id] === topCount) {
        tie = true;
      }
    });
    const impostorPlayer = room.players.find(p => p.id === room.impostorId);
    const votedOutImpostor = !tie && topId === room.impostorId;
    base.reveal = {
      secret: room.secret,
      impostorId: room.impostorId,
      impostorName: impostorPlayer ? impostorPlayer.name : '(desconectado)',
      votes: room.players.map(p => ({ id: p.id, name: p.name, voteFor: p.voteFor || null })),
      tally,
      votedOutId: tie ? null : topId,
      civilesGanan: votedOutImpostor
    };
  }
  return base;
}

function broadcastImpostor(room) {
  io.to('impostor:' + room.code).emit('impostor:state', impostorPublicState(room));
}

function destroyImpostorRoom(code) {
  impostorRooms.delete(code);
}

function startImpostorRound(room) {
  const entry = IMPOSTOR_WORD_BANK[Math.floor(Math.random() * IMPOSTOR_WORD_BANK.length)];
  room.secret = entry;
  const connected = connectedImpostorPlayers(room);
  const impostor = connected[Math.floor(Math.random() * connected.length)];
  room.impostorId = impostor.id;
  room.players.forEach(p => {
    p.voteFor = null;
  });
  room.chat = [];
  room.round += 1;
  room.screen = 'discussion';

  room.players.forEach(p => {
    if (!p.connected) return;
    const isImpostor = p.id === room.impostorId;
    io.to(p.id).emit('impostor:your-word', {
      isImpostor,
      category: entry.category,
      word: isImpostor ? null : entry.word
    });
  });

  broadcastImpostor(room);
}

io.on('connection', socket => {
  socket.on('impostor:create', (payload, cb) => {
    try {
      const name = ((payload && payload.playerName) || 'Jugador').toString().trim().slice(0, 18) || 'Jugador';
      const code = genImpostorCode();
      const room = {
        code,
        hostId: socket.id,
        screen: 'lobby',
        players: [{ id: socket.id, name, connected: true, voteFor: null }],
        secret: null,
        impostorId: null,
        chat: [],
        round: 0
      };
      impostorRooms.set(code, room);
      socket.join('impostor:' + code);
      socket.data.impostorRoomCode = code;
      broadcastImpostor(room);
      if (typeof cb === 'function') cb({ ok: true, code, playerId: socket.id, state: impostorPublicState(room) });
    } catch (e) {
      console.error('Error en impostor:create:', e);
      if (typeof cb === 'function') cb({ ok: false, error: 'Error interno del servidor al crear la sala: ' + e.message });
    }
  });

  socket.on('impostor:join', (payload, cb) => {
    try {
      const code = ((payload && payload.code) || '').toString().trim().toUpperCase();
      const name = ((payload && payload.playerName) || 'Jugador').toString().trim().slice(0, 18) || 'Jugador';
      const room = impostorRooms.get(code);
      if (!room) {
        if (typeof cb === 'function') cb({ ok: false, error: 'No existe una sala con ese código.' });
        return;
      }
      if (room.screen !== 'lobby') {
        if (typeof cb === 'function') cb({ ok: false, error: 'Esa partida ya empezó. Esperá a que termine la ronda.' });
        return;
      }
      if (connectedImpostorPlayers(room).length >= IMPOSTOR_MAX_PLAYERS) {
        if (typeof cb === 'function') cb({ ok: false, error: 'Esa sala ya está completa.' });
        return;
      }
      room.players.push({ id: socket.id, name, connected: true, voteFor: null });
      socket.join('impostor:' + code);
      socket.data.impostorRoomCode = code;
      broadcastImpostor(room);
      if (typeof cb === 'function') cb({ ok: true, code, playerId: socket.id, state: impostorPublicState(room) });
    } catch (e) {
      console.error('Error en impostor:join:', e);
      if (typeof cb === 'function') cb({ ok: false, error: 'Error interno del servidor al unirse a la sala: ' + e.message });
    }
  });

  function getImpostorRoom() {
    const code = socket.data.impostorRoomCode;
    if (!code) return null;
    return impostorRooms.get(code) || null;
  }

  socket.on('impostor:start', () => {
    const room = getImpostorRoom();
    if (!room || room.screen !== 'lobby') return;
    if (socket.id !== room.hostId) return;
    if (connectedImpostorPlayers(room).length < IMPOSTOR_MIN_PLAYERS) return;
    startImpostorRound(room);
  });

  socket.on('impostor:chat', payload => {
    const room = getImpostorRoom();
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || !player.connected) return;
    const text = ((payload && payload.text) || '').toString().trim().slice(0, 300);
    if (!text) return;
    const msg = { playerId: socket.id, name: player.name, text, ts: Date.now() };
    room.chat.push(msg);
    if (room.chat.length > 200) room.chat = room.chat.slice(-200);
    io.to('impostor:' + room.code).emit('impostor:chat-message', msg);
  });

  socket.on('impostor:startVoting', () => {
    const room = getImpostorRoom();
    if (!room || room.screen !== 'discussion') return;
    if (socket.id !== room.hostId) return;
    room.players.forEach(p => {
      p.voteFor = null;
    });
    room.screen = 'voting';
    broadcastImpostor(room);
  });

  socket.on('impostor:vote', payload => {
    const room = getImpostorRoom();
    if (!room || room.screen !== 'voting') return;
    const voter = room.players.find(p => p.id === socket.id);
    if (!voter || !voter.connected) return;
    const targetId = (payload && payload.targetId) || '';
    const target = room.players.find(p => p.id === targetId && p.connected);
    if (!target) return;
    voter.voteFor = targetId;

    const connected = connectedImpostorPlayers(room);
    const allVoted = connected.every(p => !!p.voteFor);
    if (allVoted) {
      room.screen = 'results';
    }
    broadcastImpostor(room);
  });

  socket.on('impostor:playAgain', () => {
    const room = getImpostorRoom();
    if (!room || room.screen !== 'results') return;
    if (socket.id !== room.hostId) return;
    room.screen = 'lobby';
    room.secret = null;
    room.impostorId = null;
    room.chat = [];
    room.players.forEach(p => {
      p.voteFor = null;
    });
    broadcastImpostor(room);
  });

  socket.on('impostor:leave', () => leaveImpostorRoom());
  socket.on('disconnect', () => leaveImpostorRoom());

  function leaveImpostorRoom() {
    const room = getImpostorRoom();
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (player) player.connected = false;

    if (room.hostId === socket.id) {
      const nextHost = connectedImpostorPlayers(room)[0];
      room.hostId = nextHost ? nextHost.id : null;
    }

    const stillConnected = connectedImpostorPlayers(room).length;
    if (stillConnected === 0) {
      setTimeout(() => {
        const r = impostorRooms.get(room.code);
        if (r && connectedImpostorPlayers(r).length === 0) destroyImpostorRoom(room.code);
      }, 5000);
    } else {
      broadcastImpostor(room);
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
