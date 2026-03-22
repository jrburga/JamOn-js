const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');

const app = express();

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:5173';
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json());

// Serve the built Vite client in production
const CLIENT_DIST = path.join(__dirname, '../client/dist');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(CLIENT_DIST));
}

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: ALLOWED_ORIGIN, methods: ['GET', 'POST'] },
});

// rooms[roomId] = { band_members, host_id, current_scene, session_start_epoch }
const rooms = {};

// Only band_members is a server-side store; patterns are event-only.
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

function generateRoomCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

// REST: create a new room (host calls this)
app.post('/rooms', (req, res) => {
  const roomId = generateRoomCode();
  _ensureRoom(roomId);
  res.json({ roomId });
});

// REST: check if room exists
app.get('/rooms/:roomId', (req, res) => {
  const { roomId } = req.params;
  if (rooms[roomId]) {
    res.json({ exists: true });
  } else {
    res.status(404).json({ exists: false });
  }
});

io.on('connection', (socket) => {
  let currentRoom = null;

  // Join a room as a band member — room must already exist
  socket.on('join', ({ roomId, info }, callback) => {
    const room = _getExistingRoom(roomId);
    if (!room) return callback({ success: false, error: 'room_not_found' });

    currentRoom = roomId;

    const isHost = room.host_id === null;
    if (isHost) {
      room.host_id = socket.id;
    }

    socket.join(roomId);

    callback({
      success: true,
      id: socket.id,
      isHost,
      current_scene: room.current_scene,
      protocol_version: 1,
    });

    // Notify everyone else that someone joined
    socket.to(roomId).emit('action', {
      event_type: 'on_join',
      action: { member_info: info },
    });
  });

  // Post data to the server store
  socket.on('post', ({ info_name, info }, callback) => {
    if (!currentRoom) return callback({ success: false });
    const room = _getExistingRoom(currentRoom);
    if (!room || !ROOM_STORES.has(info_name)) return callback({ success: false });

    const id = info.id !== undefined ? info.id : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    info.id = id;
    info._owner_socket_id = socket.id;
    room[info_name][id] = info;
    callback({ success: true, result: id });
  });

  // Get data from the server store
  socket.on('get', ({ info_name, identifier }, callback) => {
    if (!currentRoom) return callback({ success: false });
    const room = _getExistingRoom(currentRoom);
    if (!room || !ROOM_STORES.has(info_name)) return callback({ success: true, result: null });

    if (identifier === null || identifier === undefined) {
      callback({ success: true, result: Object.values(room[info_name]) });
    } else {
      callback({ success: true, result: room[info_name][identifier] || null });
    }
  });

  // Delete data from the server store (only the owner may delete their entry)
  socket.on('delete', ({ info_name, identifier }, callback) => {
    if (!currentRoom) return callback({ success: false });
    const room = _getExistingRoom(currentRoom);
    if (!room) return callback({ success: false });

    if (ROOM_STORES.has(info_name) && room[info_name] && identifier in room[info_name]) {
      if (room[info_name][identifier]._owner_socket_id !== socket.id) {
        return callback({ success: false, error: 'forbidden' });
      }
      delete room[info_name][identifier];
    }
    callback({ success: true, result: identifier });
  });

  // Broadcast an action to all other clients in the room
  // The server stamps sender_id so clients can trust the identity.
  socket.on('action', (actionData) => {
    if (!currentRoom) return;
    if (actionData.event_type === 'on_scene_change') {
      rooms[currentRoom].current_scene = actionData.action;
    }
    actionData.sender_id = socket.id;
    socket.to(currentRoom).emit('action', actionData);
  });

  // Return (or initialise) a shared session clock for the room
  socket.on('sync_clock', (callback) => {
    if (!currentRoom) return callback({ success: false });
    const room = _getExistingRoom(currentRoom);
    if (!room) return callback({ success: false });
    if (room.session_start_epoch === null) {
      room.session_start_epoch = Date.now();
    }
    callback({ success: true, server_now: Date.now(), session_start: room.session_start_epoch });
  });

  socket.on('disconnect', () => {
    if (currentRoom && rooms[currentRoom]) {
      const room = rooms[currentRoom];

      // Remove band member by socket id
      for (const [id, member] of Object.entries(room.band_members)) {
        if (member.socket_id === socket.id) {
          delete room.band_members[id];
          break;
        }
      }

      // If host disconnects, try to migrate to another connected member
      if (room.host_id === socket.id) {
        const nextMember = Object.values(room.band_members).find(
          (m) => m.socket_id && io.sockets.sockets.has(m.socket_id),
        );
        if (nextMember) {
          room.host_id = nextMember.socket_id;
          io.to(currentRoom).emit('action', {
            event_type: 'on_host_change',
            action: { new_host_id: nextMember.socket_id },
          });
        } else {
          // No members remain — clean up
          io.to(currentRoom).emit('action', {
            event_type: 'on_host_disconnect',
            action: {},
          });
          delete rooms[currentRoom];
        }
      }
    }
  });
});

// SPA catch-all: serve index.html for any non-API route in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`JamOn server running on port ${PORT}`);
});
