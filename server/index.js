const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// rooms[roomId] = { band_members, patterns, actions, host_id }
const rooms = {};

function getRoom(roomId) {
  if (!rooms[roomId]) {
    rooms[roomId] = {
      band_members: {},
      patterns: {},
      actions: {},
      host_id: null,
    };
  }
  return rooms[roomId];
}

function generateRoomCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

// REST: create a new room (host calls this)
app.post('/rooms', (req, res) => {
  const roomId = generateRoomCode();
  getRoom(roomId);
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

  // Join a room as a band member
  socket.on('join', ({ roomId, info }, callback) => {
    const room = getRoom(roomId);
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
    const room = getRoom(currentRoom);
    if (!(info_name in room)) return callback({ success: false });

    const id = info.id !== undefined ? info.id : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    info.id = id;
    room[info_name][id] = info;
    callback({ success: true, result: id });
  });

  // Get data from the server store
  socket.on('get', ({ info_name, identifier }, callback) => {
    if (!currentRoom) return callback({ success: false });
    const room = getRoom(currentRoom);
    if (!(info_name in room)) return callback({ success: true, result: null });

    if (identifier === null || identifier === undefined) {
      callback({ success: true, result: Object.values(room[info_name]) });
    } else {
      callback({ success: true, result: room[info_name][identifier] || null });
    }
  });

  // Delete data from the server store
  socket.on('delete', ({ info_name, identifier }, callback) => {
    if (!currentRoom) return callback({ success: false });
    const room = getRoom(currentRoom);
    if (room[info_name] && identifier in room[info_name]) {
      delete room[info_name][identifier];
    }
    callback({ success: true, result: identifier });
  });

  // Broadcast an action to all other clients in the room
  socket.on('action', (actionData) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit('action', actionData);
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
      // If host disconnects, clean up the room
      if (room.host_id === socket.id) {
        io.to(currentRoom).emit('action', {
          event_type: 'on_host_disconnect',
          action: {},
        });
        delete rooms[currentRoom];
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`JamOn server running on port ${PORT}`);
});
