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
  const ROOM_STORES = new Set(['band_members']);

  function _ensureRoom(roomId) {
    if (!rooms[roomId]) {
      rooms[roomId] = {
        band_members: {},
        host_id: null,
        current_scene: null,
        session_start_epoch: null,
      };
    }
    return rooms[roomId];
  }

  function _getExistingRoom(roomId) {
    return rooms[roomId] || null;
  }

  app.post('/rooms', (req, res) => {
    const roomId = crypto.randomBytes(3).toString('hex').toUpperCase();
    _ensureRoom(roomId);
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
      const room = _getExistingRoom(roomId);
      if (!room) return cb({ success: false, error: 'room_not_found' });

      currentRoom  = roomId;
      const isHost = room.host_id === null;
      if (isHost) room.host_id = socket.id;
      socket.join(roomId);
      cb({ success: true, id: socket.id, isHost, current_scene: room.current_scene, protocol_version: 1 });
      socket.to(roomId).emit('action', { event_type: 'on_join', action: { member_info: info } });
    });

    socket.on('post', ({ info_name, info }, cb) => {
      if (!currentRoom) return cb({ success: false });
      const room = _getExistingRoom(currentRoom);
      if (!room || !ROOM_STORES.has(info_name)) return cb({ success: false });
      const id   = info.id !== undefined ? info.id : `${Date.now()}`;
      info.id    = id;
      info._owner_socket_id = socket.id;
      room[info_name][id] = info;
      cb({ success: true, result: id });
    });

    socket.on('get', ({ info_name, identifier }, cb) => {
      if (!currentRoom) return cb({ success: false });
      const room = _getExistingRoom(currentRoom);
      if (!room || !ROOM_STORES.has(info_name)) return cb({ success: true, result: null });
      if (identifier === null || identifier === undefined) {
        cb({ success: true, result: Object.values(room[info_name]) });
      } else {
        cb({ success: true, result: room[info_name][identifier] || null });
      }
    });

    socket.on('delete', ({ info_name, identifier }, cb) => {
      if (!currentRoom) return cb({ success: false });
      const room = _getExistingRoom(currentRoom);
      if (!room) return cb({ success: false });

      if (ROOM_STORES.has(info_name) && room[info_name] && identifier in room[info_name]) {
        if (room[info_name][identifier]._owner_socket_id !== socket.id) {
          return cb({ success: false, error: 'forbidden' });
        }
        delete room[info_name][identifier];
      }
      cb({ success: true, result: identifier });
    });

    socket.on('action', (data) => {
      if (!currentRoom) return;
      if (data.event_type === 'on_scene_change') {
        rooms[currentRoom].current_scene = data.action;
      }
      data.sender_id = socket.id;
      socket.to(currentRoom).emit('action', data);
    });

    socket.on('sync_clock', (cb) => {
      if (!currentRoom) return cb({ success: false });
      const room = _getExistingRoom(currentRoom);
      if (!room) return cb({ success: false });
      if (room.session_start_epoch === null) {
        room.session_start_epoch = Date.now();
      }
      cb({ success: true, server_now: Date.now(), session_start: room.session_start_epoch });
    });

    socket.on('disconnect', () => {
      if (currentRoom && rooms[currentRoom]) {
        const room = rooms[currentRoom];
        for (const [id, member] of Object.entries(room.band_members)) {
          if (member.socket_id === socket.id) {
            delete room.band_members[id];
            break;
          }
        }
        if (room.host_id === socket.id) {
          const nextMember = Object.values(room.band_members).find(
            (m) => m.socket_id && ioServer.sockets.sockets.has(m.socket_id),
          );
          if (nextMember) {
            room.host_id = nextMember.socket_id;
            ioServer.to(currentRoom).emit('action', {
              event_type: 'on_host_change',
              action: { new_host_id: nextMember.socket_id },
            });
          } else {
            ioServer.to(currentRoom).emit('action', { event_type: 'on_host_disconnect', action: {} });
            delete rooms[currentRoom];
          }
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

/** Create a room via HTTP and return its roomId. */
async function createRoom(app) {
  const res = await supertest(app).post('/rooms');
  return res.body.roomId;
}

/** Create a room and join it with the given socket. */
async function createAndJoin(socket, app) {
  const roomId = await createRoom(app);
  return new Promise((resolve) => {
    socket.emit('join', { roomId, info: { username: 'TestUser' } }, (res) => resolve({ roomId, res }));
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
  let app, httpServer, ioServer;
  let port;
  const sockets = [];

  beforeAll((done) => {
    ({ app, httpServer, ioServer } = buildApp());
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
    const { res } = await createAndJoin(s, app);
    expect(res.success).toBe(true);
    expect(res.isHost).toBe(true);
    expect(typeof res.id).toBe('string');
    expect(res.protocol_version).toBe(1);
  });

  it('second client to join the same room is NOT host', async () => {
    const s1 = await connectClient(port);
    const s2 = await connectClient(port);
    sockets.push(s1, s2);

    const { roomId, res: r1 } = await createAndJoin(s1, app);
    const r2 = await joinRoom(s2, roomId);

    expect(r1.isHost).toBe(true);
    expect(r2.isHost).toBe(false);
  });

  it('joining clients receive different socket ids', async () => {
    const s1 = await connectClient(port);
    const s2 = await connectClient(port);
    sockets.push(s1, s2);

    const { roomId, res: r1 } = await createAndJoin(s1, app);
    const r2 = await joinRoom(s2, roomId);
    expect(r1.id).not.toBe(r2.id);
  });

  it('second client receives an on_join action broadcast', async () => {
    const s1 = await connectClient(port);
    sockets.push(s1);
    const { roomId } = await createAndJoin(s1, app);

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

  it('join fails for a non-existent room', async () => {
    const s = await connectClient(port);
    sockets.push(s);
    const res = await joinRoom(s, 'NOSUCHROOM');
    expect(res.success).toBe(false);
    expect(res.error).toBe('room_not_found');
  });
});

describe('WebSocket — post / get / delete', () => {
  let app, httpServer, ioServer;
  let port, socket, roomId;

  beforeAll((done) => {
    ({ app, httpServer, ioServer } = buildApp());
    httpServer.listen(0, async () => {
      port   = httpServer.address().port;
      socket = await connectClient(port);
      ({ roomId } = await createAndJoin(socket, app));
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
    socket.emit('post', { info_name: 'band_members', info: { id: 'member-custom', username: 'Bob' } }, (res) => {
      expect(res.result).toBe('member-custom');
      done();
    });
  });

  it('post fails for an unknown info_name', (done) => {
    socket.emit('post', { info_name: 'NONEXISTENT', info: {} }, (res) => {
      expect(res.success).toBe(false);
      done();
    });
  });

  it('post fails for the patterns info_name (patterns are event-only)', (done) => {
    socket.emit('post', { info_name: 'patterns', info: { id: 'pat-1', inst: 'piano' } }, (res) => {
      expect(res.success).toBe(false);
      done();
    });
  });

  // get
  it('get returns all items when identifier is null', (done) => {
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
    socket.emit('post', { info_name: 'band_members', info: { id: 'bm-99', username: 'Charlie' } }, () => {
      socket.emit('get', { info_name: 'band_members', identifier: 'bm-99' }, (res) => {
        expect(res.success).toBe(true);
        expect(res.result).toMatchObject({ username: 'Charlie' });
        done();
      });
    });
  });

  it('get returns null for a non-existent id', (done) => {
    socket.emit('get', { info_name: 'band_members', identifier: 'no-such-id' }, (res) => {
      expect(res.success).toBe(true);
      expect(res.result).toBeNull();
      done();
    });
  });

  // delete
  it('delete removes an item from the store', (done) => {
    socket.emit('post', { info_name: 'band_members', info: { id: 'del-me', username: 'Dave' } }, () => {
      socket.emit('delete', { info_name: 'band_members', identifier: 'del-me' }, (res) => {
        expect(res.success).toBe(true);
        socket.emit('get', { info_name: 'band_members', identifier: 'del-me' }, (getRes) => {
          expect(getRes.result).toBeNull();
          done();
        });
      });
    });
  });

  it('delete is a no-op for a non-existent id and still succeeds', (done) => {
    socket.emit('delete', { info_name: 'band_members', identifier: 'ghost-id' }, (res) => {
      expect(res.success).toBe(true);
      done();
    });
  });

  it('delete fails with forbidden when a non-owner tries to delete', async () => {
    // Owner posts an item
    const ownerId = await new Promise((resolve) => {
      socket.emit('post', { info_name: 'band_members', info: { id: 'owned-item', username: 'Owner' } }, (res) => {
        resolve(res.result);
      });
    });

    // A different socket joins the same room and tries to delete it
    const other = await connectClient(port);
    await joinRoom(other, roomId);

    const res = await new Promise((resolve) => {
      other.emit('delete', { info_name: 'band_members', identifier: ownerId }, resolve);
    });
    expect(res.success).toBe(false);
    expect(res.error).toBe('forbidden');

    other.disconnect();
  });
});

describe('WebSocket — action broadcasting', () => {
  let app, httpServer, ioServer;
  let port;
  const sockets = [];

  beforeAll((done) => {
    ({ app, httpServer, ioServer } = buildApp());
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
    const s1 = await connectClient(port);
    const s2 = await connectClient(port);
    const s3 = await connectClient(port);
    sockets.push(s1, s2, s3);
    const { roomId } = await createAndJoin(s1, app);
    await joinRoom(s2, roomId);
    await joinRoom(s3, roomId);

    const filter = (socket) => new Promise((resolve) => {
      socket.on('action', function handler(d) {
        if (d.event_type === 'test_action') { socket.off('action', handler); resolve(d); }
      });
    });
    const s2Received = filter(s2);
    const s3Received = filter(s3);
    const s1Received = new Promise((res) => {
      const t = setTimeout(res, 200, null);
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

  it('forwarded actions include a server-stamped sender_id', async () => {
    const s1 = await connectClient(port);
    const s2 = await connectClient(port);
    sockets.push(s1, s2);
    const { roomId } = await createAndJoin(s1, app);
    await joinRoom(s2, roomId);

    const received = new Promise((resolve) => {
      s2.on('action', function handler(d) {
        if (d.event_type === 'stamp_test') { s2.off('action', handler); resolve(d); }
      });
    });

    s1.emit('action', { event_type: 'stamp_test', action: {} });
    const evt = await received;
    expect(typeof evt.sender_id).toBe('string');
    expect(evt.sender_id.length).toBeGreaterThan(0);
  });

  it('actions do not bleed into other rooms', async () => {
    const s1 = await connectClient(port);
    const s2 = await connectClient(port);
    sockets.push(s1, s2);
    const { roomId: roomA } = await createAndJoin(s1, app);
    const { roomId: roomB } = await createAndJoin(s2, app);
    expect(roomA).not.toBe(roomB);

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

describe('WebSocket — sync_clock', () => {
  let app, httpServer, ioServer;
  let port;
  const sockets = [];

  beforeAll((done) => {
    ({ app, httpServer, ioServer } = buildApp());
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

  it('returns session_start and server_now', async () => {
    const s = await connectClient(port);
    sockets.push(s);
    await createAndJoin(s, app);

    const res = await new Promise((resolve) => s.emit('sync_clock', resolve));
    expect(res.success).toBe(true);
    expect(typeof res.session_start).toBe('number');
    expect(typeof res.server_now).toBe('number');
    expect(res.server_now).toBeGreaterThanOrEqual(res.session_start);
  });

  it('all clients in the same room share the same session_start', async () => {
    const s1 = await connectClient(port);
    const s2 = await connectClient(port);
    sockets.push(s1, s2);
    const { roomId } = await createAndJoin(s1, app);
    await joinRoom(s2, roomId);

    const r1 = await new Promise((resolve) => s1.emit('sync_clock', resolve));
    const r2 = await new Promise((resolve) => s2.emit('sync_clock', resolve));
    expect(r1.session_start).toBe(r2.session_start);
  });

  it('different rooms have independent session clocks', async () => {
    const s1 = await connectClient(port);
    const s2 = await connectClient(port);
    sockets.push(s1, s2);

    // Establish clock in room 1, wait for the epoch to be set.
    await createAndJoin(s1, app);
    const r1 = await new Promise((resolve) => s1.emit('sync_clock', resolve));

    // Wait long enough that any new epoch will differ.
    await new Promise((r) => setTimeout(r, 20));

    // Create room 2 and establish its own clock.
    await createAndJoin(s2, app);
    const r2 = await new Promise((resolve) => s2.emit('sync_clock', resolve));

    expect(r1.session_start).not.toBe(r2.session_start);
    expect(r2.session_start).toBeGreaterThan(r1.session_start);
  });
});
