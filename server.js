const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const PORT = process.env.PORT || 3001;

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    path: '/api/socket',
    cors: { origin: '*' },
  });

  const MAX_MESSAGES_PER_ROOM = 100;
  const rooms = new Map(); // roomId -> array of messages
  const onlineUsers = new Map(); // socketId -> { userId, userName, room }

  const ROOMS = ['equities', 'crypto', 'india-markets', 'macro', 'general'];
  ROOMS.forEach(r => rooms.set(r, []));

  io.on('connection', (socket) => {
    let currentUser = null;

    socket.on('join', ({ userId, userName, room }) => {
      const targetRoom = ROOMS.includes(room) ? room : 'general';
      socket.join(targetRoom);
      currentUser = { userId, userName, room: targetRoom };
      onlineUsers.set(socket.id, currentUser);

      // Send message history for this room
      socket.emit('history', rooms.get(targetRoom) ?? []);

      // Broadcast updated online count
      const roomUsers = Array.from(onlineUsers.values()).filter(u => u.room === targetRoom);
      io.to(targetRoom).emit('online_count', roomUsers.length);
      io.to(targetRoom).emit('user_joined', { userName, room: targetRoom });
    });

    socket.on('switch_room', ({ room }) => {
      if (!currentUser) return;
      const oldRoom = currentUser.room;
      const newRoom = ROOMS.includes(room) ? room : 'general';
      socket.leave(oldRoom);
      socket.join(newRoom);
      currentUser.room = newRoom;
      onlineUsers.set(socket.id, currentUser);

      socket.emit('history', rooms.get(newRoom) ?? []);

      const oldRoomUsers = Array.from(onlineUsers.values()).filter(u => u.room === oldRoom);
      const newRoomUsers = Array.from(onlineUsers.values()).filter(u => u.room === newRoom);
      io.to(oldRoom).emit('online_count', oldRoomUsers.length);
      io.to(newRoom).emit('online_count', newRoomUsers.length);
    });

    socket.on('message', ({ text, userId, userName }) => {
      if (!currentUser || !text?.trim()) return;

      // Extract @TICKER mentions (uppercase 1-5 letters after @)
      const tickerMatches = text.match(/@([A-Z]{1,5})\b/g) ?? [];
      const tickers = tickerMatches.map((t) => t.slice(1));

      const message = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        text: text.trim().slice(0, 500), // max 500 chars
        userId,
        userName,
        room: currentUser.room,
        tickers,
        timestamp: new Date().toISOString(),
      };

      const roomMessages = rooms.get(currentUser.room) ?? [];
      roomMessages.push(message);
      if (roomMessages.length > MAX_MESSAGES_PER_ROOM) {
        roomMessages.shift();
      }
      rooms.set(currentUser.room, roomMessages);

      io.to(currentUser.room).emit('message', message);
    });

    socket.on('typing', ({ userName }) => {
      if (!currentUser) return;
      socket.to(currentUser.room).emit('user_typing', { userName });
    });

    socket.on('disconnect', () => {
      if (currentUser) {
        onlineUsers.delete(socket.id);
        const roomUsers = Array.from(onlineUsers.values()).filter(u => u.room === currentUser.room);
        io.to(currentUser.room).emit('online_count', roomUsers.length);
        io.to(currentUser.room).emit('user_left', { userName: currentUser.userName });
      }
    });
  });

  httpServer.listen(PORT, () => {
    console.log(`> Ready on http://localhost:${PORT}`);
  });
});
