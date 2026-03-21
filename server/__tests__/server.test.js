/**
 * server.test.js — Integration tests for the JamOn server.
 *
 * Uses supertest for HTTP endpoints and socket.io-client for WebSocket
 * interactions.  A real server is started on a random port before each
 * test suite and torn down afterwards.
 */

const { createServer } = require('http');
const { Server }       = require('socket.io');
const { io: ioc }      = require('socket.io-client');
const express          = require('express');
const cors             = require('cors');
const crypto           = require('crypto');
const supertest        = require('supertest');

// ── Re-create the server inline so tests are isolated ─────────────────────
// (We can't just `require('../index.js')` because it calls listen() immediately
// and we need to control the port.)

function buildApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const httpServer = createServer(app);
  const ioServer   = new Server(httpServer, { cors: { origin: '*' } });

  const rooms = {};

  function getRoom(roomId) {
    if (!rooms[roomId]) {
      rooms[roomId] = { band_members: {}, patterns: {}, actions: {}, host_id: null };
    }
    return rooms[roomId];
  }

  app.post('/rooms', (req, res) => {
    const roomId = crypto.randomBytes(3).toString('hex').toUpperCase();
    getRoom(roomId);
    res.json({ roomId });
  });

  app.get('/rooms/:roomId', (req, res) => {
    const { roomId } = req.params;
    if (rooms[roomId]) res.json({ exists: true });
    else res.status(404).json({ exists: false });
  });

  ioServer.on('connection', (socket) => {
    let currentRoom = null;

    socket.on('join', ({ roomId, info }, cb) => {
      const room   = getRoom(roomId);
      currentRoom  = roomId;
      const isHost = room.host_id === null;
      if (isHost) room.host_id = socket.id;
      socket.join(roomId);
      cb({ success: true, id: socket.id, isHost });
      socket.to(roomId).emit('action', { event_type: 'on_join', action: { member_info: info } });
    });

    socket.on('post', ({ info_name, info }, cb) => {
      if (!currentRoom) return cb({ success: false });
      const room = getRoom(currentRoom);
      if (!(info_name in room)) return cb({ success: false });
      const id   = info.id !== undefined ? info.id : `${Date.now()}`;
      info.id    = id;
      room[info_name][id] = info;
      cb({ success: true, result: id });
    });

    socket.on('get', ({ info_name, identifier }, cb) => {
      if (!currentRoom) return cb({ success: false });
      const room = getRoom(currentRoom);
      if (!(info_name in room)) return cb({ success: true, result: null });
      if (identifier === null || identifier === undefined) {
        cb({ success: true, result: Object.values(room[info_name]) });
      } else {
        cb({ success: true, result: room[info_name][identifier] || null });
      }
    });

    socket.on('delete', ({ info_name, identifier }, cb) => {
      if (!currentRoom) return cb({ success: false });
      const room = getRoom(currentRoom);
      if (room[info_name] && identifier in room[info_name]) {
        delete room[info_name][identifier];
      }
      cb({ success: true, result: identifier });
    });

    socket.on('action', (data) => {
      if (!currentRoom) return;
      socket.to(currentRoom).emit('action', data);
    });

    socket.on('disconnect', () => {
      if (currentRoom && rooms[currentRoom]) {
        if (rooms[currentRoom].host_id === socket.id) {
          ioServer.to(currentRoom).emit('action', { event_type: 'on_host_disconnect', action: {} });
          delete rooms[currentRoom];
        }
      }
    });
  });

  return { app, httpServer, ioServer, rooms };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function connectClient(port) {
  return new Promise((resolve) => {
    const socket = ioc(`http://localhost:${port}`, { transports: ['websocket'] });
    socket.on('connect', () => resolve(socket));
  });
}

function joinRoom(socket, roomId) {
  return new Promise((resolve) => {
    socket.emit('join', { roomId, info: { username: 'TestUser' } }, resolve);
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('HTTP endpoints', () => {
  let app, httpServer, ioServer, request;

  beforeAll((done) => {
    ({ app, httpServer, ioServer } = buildApp());
    httpServer.listen(0, done); // port 0 → OS assigns a free port
    request = supertest(app);
  });

  afterAll(async () => {
    await new Promise((r) => ioServer.close(() => r())).catch(() => {});
  });

  // POST /rooms
  it('POST /rooms creates a room and returns a 6-char code', async () => {
    const res = await request.post('/rooms').expect(200);
    expect(res.body).toHaveProperty('roomId');
    expect(typeof res.body.roomId).toBe('string');
    expect(res.body.roomId).toHaveLength(6);
  });

  it('POST /rooms returns unique codes on repeated calls', async () => {
    const r1 = await request.post('/rooms');
    const r2 = await request.post('/rooms');
    expect(r1.body.roomId).not.toBe(r2.body.roomId);
  });

  // GET /rooms/:id
  it('GET /rooms/:id returns exists:true for a created room', async () => {
    const { body: { roomId } } = await request.post('/rooms');
    const res = await request.get(`/rooms/${roomId}`).expect(200);
    expect(res.body.exists).toBe(true);
  });

  it('GET /rooms/:id returns 404 for an unknown room', async () => {
    await request.get('/rooms/DOESNOTEXIST').expect(404);
  });
});

describe('WebSocket — join', () => {
  let httpServer, ioServer;
  let port;
  const sockets = [];

  beforeAll((done) => {
    ({ httpServer, ioServer } = buildApp());
    httpServer.listen(0, () => {
      port = httpServer.address().port;
      done();
    });
  });

  afterAll(async () => {
    for (const s of sockets) s.disconnect();
    await new Promise((r) => setTimeout(r, 50));
    await new Promise((r) => ioServer.close(() => r())).catch(() => {});
  });

  it('first client to join a room becomes host', async () => {
    const s = await connectClient(port);
    sockets.push(s);
    const roomId = 'TESTROOM';
    const res = await joinRoom(s, roomId);
    expect(res.success).toBe(true);
    expect(res.isHost).toBe(true);
    expect(typeof res.id).toBe('string');
  });

  it('second client to join the same room is NOT host', async () => {
    const roomId = 'SHARED';
    const s1 = await connectClient(port);
    const s2 = await connectClient(port);
    sockets.push(s1, s2);

    const r1 = await joinRoom(s1, roomId);
    const r2 = await joinRoom(s2, roomId);

    expect(r1.isHost).toBe(true);
    expect(r2.isHost).toBe(false);
  });

  it('joining clients receive different socket ids', async () => {
    const roomId = 'IDS';
    const s1 = await connectClient(port);
    const s2 = await connectClient(port);
    sockets.push(s1, s2);

    const r1 = await joinRoom(s1, roomId);
    const r2 = await joinRoom(s2, roomId);
    expect(r1.id).not.toBe(r2.id);
  });

  it('second client receives an on_join action broadcast', async () => {
    const roomId = 'JOINEVT';
    const s1 = await connectClient(port);
    sockets.push(s1);
    await joinRoom(s1, roomId);

    const s2 = await connectClient(port);
    sockets.push(s2);

    const actionReceived = new Promise((resolve) => {
      s1.on('action', (data) => {
        if (data.event_type === 'on_join') resolve(data);
      });
    });

    joinRoom(s2, roomId);
    const evt = await actionReceived;
    expect(evt.action.member_info.username).toBe('TestUser');
  });
});

describe('WebSocket — post / get / delete', () => {
  let httpServer, ioServer;
  let port, socket;

  beforeAll((done) => {
    ({ httpServer, ioServer } = buildApp());
    httpServer.listen(0, async () => {
      port   = httpServer.address().port;
      socket = await connectClient(port);
      await joinRoom(socket, 'STOREROOM');
      done();
    });
  });

  afterAll(async () => {
    socket.disconnect();
    await new Promise((r) => setTimeout(r, 50));
    await new Promise((r) => ioServer.close(() => r())).catch(() => {});
  });

  // post
  it('post stores a band member and returns an id', (done) => {
    socket.emit('post', { info_name: 'band_members', info: { username: 'Alice' } }, (res) => {
      expect(res.success).toBe(true);
      expect(typeof res.result).toBe('string');
      done();
    });
  });

  it('post assigns a provided id without overriding it', (done) => {
    socket.emit('post', { info_name: 'patterns', info: { id: 'pat-custom', inst: 'piano' } }, (res) => {
      expect(res.result).toBe('pat-custom');
      done();
    });
  });

  it('post fails for an unknown info_name', (done) => {
    socket.emit('post', { info_name: 'NONEXISTENT', info: {} }, (res) => {
      expect(res.success).toBe(false);
      done();
    });
  });

  // get
  it('get returns all items when identifier is null', (done) => {
    // First store something
    socket.emit('post', { info_name: 'band_members', info: { username: 'Bob' } }, () => {
      socket.emit('get', { info_name: 'band_members', identifier: null }, (res) => {
        expect(res.success).toBe(true);
        expect(Array.isArray(res.result)).toBe(true);
        expect(res.result.length).toBeGreaterThan(0);
        done();
      });
    });
  });

  it('get returns a specific item by id', (done) => {
    socket.emit('post', { info_name: 'patterns', info: { id: 'p99', inst: 'guitar' } }, () => {
      socket.emit('get', { info_name: 'patterns', identifier: 'p99' }, (res) => {
        expect(res.success).toBe(true);
        expect(res.result).toMatchObject({ inst: 'guitar' });
        done();
      });
    });
  });

  it('get returns null for a non-existent id', (done) => {
    socket.emit('get', { info_name: 'patterns', identifier: 'no-such-id' }, (res) => {
      expect(res.success).toBe(true);
      expect(res.result).toBeNull();
      done();
    });
  });

  // delete
  it('delete removes an item from the store', (done) => {
    socket.emit('post', { info_name: 'patterns', info: { id: 'del-me', inst: 'bass' } }, () => {
      socket.emit('delete', { info_name: 'patterns', identifier: 'del-me' }, (res) => {
        expect(res.success).toBe(true);
        // Verify it's really gone
        socket.emit('get', { info_name: 'patterns', identifier: 'del-me' }, (getRes) => {
          expect(getRes.result).toBeNull();
          done();
        });
      });
    });
  });

  it('delete is a no-op for a non-existent id and still succeeds', (done) => {
    socket.emit('delete', { info_name: 'patterns', identifier: 'ghost-id' }, (res) => {
      expect(res.success).toBe(true);
      done();
    });
  });
});

describe('WebSocket — action broadcasting', () => {
  let httpServer, ioServer;
  let port;
  const sockets = [];

  beforeAll((done) => {
    ({ httpServer, ioServer } = buildApp());
    httpServer.listen(0, () => {
      port = httpServer.address().port;
      done();
    });
  });

  afterAll(async () => {
    for (const s of sockets) s.disconnect();
    await new Promise((r) => setTimeout(r, 50));
    await new Promise((r) => ioServer.close(() => r())).catch(() => {});
  });

  it('action is broadcast to other clients in the room but not the sender', async () => {
    const roomId = 'BROADCAST';
    const s1 = await connectClient(port);
    const s2 = await connectClient(port);
    const s3 = await connectClient(port);
    sockets.push(s1, s2, s3);
    await joinRoom(s1, roomId);
    await joinRoom(s2, roomId);
    await joinRoom(s3, roomId);

    // Filter to only the specific test_action type — other actions (e.g. on_join
    // broadcasts from the room setup above) also arrive on this socket.
    const filter = (socket) => new Promise((resolve) => {
      socket.on('action', function handler(d) {
        if (d.event_type === 'test_action') { socket.off('action', handler); resolve(d); }
      });
    });
    const s2Received = filter(s2);
    const s3Received = filter(s3);
    const s1Received = new Promise((res) => {
      const t = setTimeout(res, 200, null); // resolves null if not received
      s1.on('action', function handler(d) {
        if (d.event_type === 'test_action') { clearTimeout(t); s1.off('action', handler); res(d); }
      });
    });

    s1.emit('action', { event_type: 'test_action', action: { val: 42 } });

    const [r2, r3, r1] = await Promise.all([s2Received, s3Received, s1Received]);
    expect(r2.event_type).toBe('test_action');
    expect(r3.event_type).toBe('test_action');
    expect(r1).toBeNull(); // sender did not receive it
  });

  it('actions do not bleed into other rooms', async () => {
    const s1 = await connectClient(port);
    const s2 = await connectClient(port);
    sockets.push(s1, s2);
    await joinRoom(s1, 'ROOM_A');
    await joinRoom(s2, 'ROOM_B');

    const s2Received = new Promise((res) => {
      const t = setTimeout(res, 200, null);
      s2.on('action', function handler(d) {
        if (d.event_type === 'cross_room') { clearTimeout(t); s2.off('action', handler); res(d); }
      });
    });

    s1.emit('action', { event_type: 'cross_room', action: {} });
    const result = await s2Received;
    expect(result).toBeNull(); // different room, should not receive
  });
});
