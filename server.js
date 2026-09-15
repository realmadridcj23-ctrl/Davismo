const path = require('path');
const fs = require('fs');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { CATEGORIES, normalize } = require('./gameData');

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

// ==================== MENTIROSO ONLINE ====================
const rooms = new Map(); // code -> room

function categoriesMeta() {
  return Object.keys(CATEGORIES).map(key => {
    const c = CATEGORIES[key];
    return { key, label: c.label, short: c.short, hint: c.hint, count: c.items.length };
  });
}

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
    roundsPlayed: room.roundsPlayed
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
  room.usedIdx = new Set();
  room.answersGiven = [];
  room.failReason = '';
  room.screen = 'bid';
  broadcast(room);
}

function startChallenge(room) {
  room.screen = 'challenge';
  room.timeLeft = room.timeLimit;
  room.answersGiven = [];
  room.usedIdx = new Set();
  room.failReason = '';
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
      usedIdx: new Set(),
      answersGiven: [],
      timeLeft: 0,
      timerId: null,
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
    const max = poolSize(room);
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

  socket.on('mentiroso:answer', payload => {
    const room = getRoom();
    if (!room || room.screen !== 'challenge') return;
    if (socket.data.playerIndex !== room.bidder) return;
    const raw = ((payload && payload.text) || '').toString();
    if (!raw.trim()) return;
    const cat = CATEGORIES[room.categoryKey];
    const norm = normalize(raw);
    let foundIdx = -1;
    for (let i = 0; i < cat.items.length; i++) {
      if (room.usedIdx.has(i)) continue;
      if (cat.items[i].aliases.some(a => normalize(a) === norm)) {
        foundIdx = i;
        break;
      }
    }
    if (foundIdx === -1) {
      const isKnownButUsed = cat.items.some(
        (item, i) => room.usedIdx.has(i) && item.aliases.some(a => normalize(a) === norm)
      );
      stopTimer(room);
      finishChallenge(room, false, isKnownButUsed ? 'duplicado' : 'invalido', raw);
      return;
    }
    room.usedIdx.add(foundIdx);
    room.answersGiven.push(cat.items[foundIdx].display);
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
});
