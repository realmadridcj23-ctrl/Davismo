require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { CATEGORIES, normalize, referenceNames } = require('./gameData');

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
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

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

function extractJson(text) {
  // Saca el texto de un posible bloque ```json ... ``` y parsea.
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('La IA no devolvió JSON válido');
  return JSON.parse(cleaned.slice(start, end + 1));
}

// ---- Verificación de una respuesta contra UNA categoría puntual ----
async function verifyAnswerInCategory(query, categoryKey) {
  const cat = CATEGORIES[categoryKey];
  if (!cat) throw new Error('Categoría inválida');

  const examples = referenceNames(categoryKey).join(', ');
  const system =
    'Sos el árbitro de un juego de trivia futbolera llamado "Mentiroso Futbolero". ' +
    'Te doy una categoría y una respuesta que dio un jugador, y tenés que decidir si esa ' +
    'respuesta es correcta para esa categoría, usando tu conocimiento real de fútbol (no solo ' +
    'la lista de ejemplos que te paso, que es solo una referencia parcial para orientarte). ' +
    'Aceptá apodos, apellidos solos, errores menores de tipeo/acentos, y nombres en cualquier ' +
    'formato razonable, siempre que se refieran sin ambigüedad a una respuesta correcta. ' +
    'Si la respuesta es ambigua, incompleta, de otra categoría, o simplemente incorrecta, marcala como inválida. ' +
    'Respondé ÚNICAMENTE con un objeto JSON, sin texto extra, con este formato exacto: ' +
    '{"valid": true|false, "display": "Nombre canónico bien escrito, o null si no es válido", "reason": "explicación breve en español, una frase"}';

  const userMsg =
    'Categoría: "' + cat.label + '"\n' +
    'Descripción: ' + cat.hint + '\n' +
    'Ejemplos de referencia (no exhaustivo): ' + examples + '\n' +
    'Respuesta del jugador a evaluar: "' + query + '"';

  const raw = await callClaude({
    system,
    messages: [{ role: 'user', content: userMsg }],
    maxTokens: 300
  });

  const parsed = extractJson(raw);
  return {
    valid: !!parsed.valid,
    display: parsed.valid ? (parsed.display || query) : null,
    reason: parsed.reason || ''
  };
}

// ---- Verificación contra TODAS las categorías (para el asistente) ----
async function verifyAnswerAllCategories(query) {
  const keys = Object.keys(CATEGORIES);
  const catBlocks = keys
    .map(
      k =>
        '- key: "' +
        k +
        '", categoría: "' +
        CATEGORIES[k].label +
        '", descripción: ' +
        CATEGORIES[k].hint +
        ' Ejemplos: ' +
        referenceNames(k).slice(0, 12).join(', ') +
        '...'
    )
    .join('\n');

  const system =
    'Sos el árbitro de un juego de trivia futbolera llamado "Mentiroso Futbolero". ' +
    'Te paso una lista de categorías posibles y una respuesta de un jugador. Decidí en cuál o ' +
    'cuáles categorías esa respuesta sería válida, usando tu conocimiento real de fútbol (los ' +
    'ejemplos son solo referencia parcial, no la única verdad). Si no es válida en ninguna, la ' +
    'lista queda vacía. Respondé ÚNICAMENTE con JSON, sin texto extra, formato exacto: ' +
    '{"matches": [{"categoryKey": "clave_exacta", "display": "Nombre canónico bien escrito"}]}';

  const userMsg = 'Categorías:\n' + catBlocks + '\n\nRespuesta del jugador a evaluar: "' + query + '"';

  const raw = await callClaude({
    system,
    messages: [{ role: 'user', content: userMsg }],
    maxTokens: 400
  });

  const parsed = extractJson(raw);
  const matches = Array.isArray(parsed.matches) ? parsed.matches : [];
  return matches
    .filter(m => m && CATEGORIES[m.categoryKey])
    .map(m => ({
      categoryKey: m.categoryKey,
      categoryLabel: CATEGORIES[m.categoryKey].label,
      display: m.display || query
    }));
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

// Verificación de una respuesta contra una categoría (o todas), usando IA real.
// La usan: 1) el botón "Asistente" para consultar una respuesta suelta,
//          2) el modo LOCAL del Mentiroso (mismo dispositivo) para validar en vivo.
app.post('/api/asistente/verificar', async (req, res) => {
  const body = req.body || {};
  const query = (body.query || '').toString().trim();
  const categoryKey = (body.categoryKey || '').toString().trim();

  if (!query) {
    return res.status(400).json({ ok: false, error: 'Escribí un nombre para verificar.' });
  }
  if (categoryKey && !CATEGORIES[categoryKey]) {
    return res.status(400).json({ ok: false, error: 'Esa categoría no existe.' });
  }
  if (!aiAvailable()) {
    return res.status(503).json({
      ok: false,
      error:
        'La IA todavía no está configurada en el servidor. Definí la variable de entorno ANTHROPIC_API_KEY (ver .env.example) y reiniciá el servidor.'
    });
  }

  try {
    if (categoryKey) {
      const result = await verifyAnswerInCategory(query, categoryKey);
      const matches = result.valid
        ? [{ categoryKey, categoryLabel: CATEGORIES[categoryKey].label, display: result.display }]
        : [];
      return res.json({ ok: true, query, valid: result.valid, matches, reason: result.reason });
    }
    const matches = await verifyAnswerAllCategories(query);
    return res.json({ ok: true, query, valid: matches.length > 0, matches });
  } catch (e) {
    console.error('Error verificando respuesta con IA:', e);
    return res.status(502).json({
      ok: false,
      error: 'No se pudo consultar a la IA en este momento. Probá de nuevo en unos segundos.'
    });
  }
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
        'La IA todavía no está configurada en el servidor. Definí la variable de entorno ANTHROPIC_API_KEY (ver .env.example) y reiniciá el servidor.'
    });
  }

  const system =
    'Sos el Asistente de IA de davismo, la comunidad y el sitio de fútbol de "davismo". ' +
    'Hablás en español rioplatense, con onda, cercano, pero sin exagerar el voseo ni ser payasesco. ' +
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

  // La verificación de cada respuesta se hace con IA (async), por eso este
  // handler es async y avisa "pendingCheck" mientras espera la respuesta
  // del modelo, para que el cliente pueda mostrar "revisando...".
  socket.on('mentiroso:answer', async payload => {
    const room = getRoom();
    if (!room || room.screen !== 'challenge') return;
    if (socket.data.playerIndex !== room.bidder) return;
    if (room.pendingCheck) return;

    const raw = ((payload && payload.text) || '').toString();
    if (!raw.trim()) return;

    room.pendingCheck = true;
    io.to(room.code).emit('mentiroso:checking', { text: raw });

    let result = null;
    let failedToVerify = false;
    try {
      result = await verifyAnswerInCategory(raw, room.categoryKey);
    } catch (e) {
      console.error('Error verificando respuesta (online):', e);
      failedToVerify = true;
    }

    // La sala pudo haber cambiado mientras esperábamos a la IA (ej: se acabó
    // el tiempo). Si ya no estamos en 'challenge', no hacemos nada más.
    const freshRoom = rooms.get(room.code);
    if (!freshRoom || freshRoom.screen !== 'challenge') return;

    freshRoom.pendingCheck = false;

    if (failedToVerify) {
      io.to(freshRoom.code).emit('mentiroso:answer-error', {
        message: 'No se pudo verificar con la IA, probá de nuevo.'
      });
      broadcast(freshRoom);
      return;
    }

    if (!result.valid) {
      stopTimer(freshRoom);
      finishChallenge(freshRoom, false, 'invalido', raw);
      return;
    }

    const canonicalNorm = normalize(result.display);
    if (freshRoom.acceptedNormalized.includes(canonicalNorm)) {
      stopTimer(freshRoom);
      finishChallenge(freshRoom, false, 'duplicado', raw);
      return;
    }

    freshRoom.acceptedNormalized.push(canonicalNorm);
    freshRoom.answersGiven.push(result.display);

    if (freshRoom.answersGiven.length >= freshRoom.bid) {
      stopTimer(freshRoom);
      finishChallenge(freshRoom, true);
      return;
    }

    broadcast(freshRoom);
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
})