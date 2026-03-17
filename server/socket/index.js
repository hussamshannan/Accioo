const socketAuthMiddleware = require("../middleware/socketAuthMiddleware");
const chatHandlers = require("./chatHandlers");
const callHandlers = require("./callHandlers");
const presenceHandlers = require("./presenceHandlers");
const { init, register, unregister, userSockets } = require("./socketEmitter");
const User = require("../models/User");

// Store room data (kept from original server.js)
const rooms = new Map();

const setupSocket = (io) => {
  init(io);
  io.use(socketAuthMiddleware);

  io.on("connection", (socket) => {
    // Track user → socket mapping for direct notifications
    if (socket.clerkId) {
      register(socket.clerkId, socket.id);
      // Mark user online and broadcast to friends
      User.findOneAndUpdate({ clerkId: socket.clerkId }, { isOnline: true })
        .populate("friends", "clerkId")
        .then((user) => {
          if (!user) return;
          socket._mongoUserId = user._id;
          user.friends.forEach((f) =>
            emitToUser(f.clerkId, "friend-online", { userId: user._id.toString() })
          );
        })
        .catch(() => {});
    }

    // Heartbeat
    socket.on("heartbeat", () => {
      socket.emit("heartbeat-ack");
    });

    socket.on("rejoin-room", (data) => {
      socket.join(data.roomId);
    });

    // Room management
    socket.on("join-room", (roomId) => {
      // Leave previous rooms
      const previousRooms = Array.from(socket.rooms).filter(
        (room) => room !== socket.id
      );
      for (const room of previousRooms) {
        socket.leave(room);
      }

      socket.join(roomId);
      socket.roomId = roomId;

      if (!rooms.has(roomId)) {
        rooms.set(roomId, { users: new Set() });
      }
      rooms.get(roomId).users.add(socket.id);

      socket.to(roomId).emit("user-connected", socket.id);

      const userCount = rooms.get(roomId).users.size;
      socket.emit("room-joined", { roomId, userCount });
    });

    // Register handlers
    chatHandlers(io, socket, rooms);
    callHandlers(io, socket, rooms);
    presenceHandlers(io, socket, rooms);

    // Disconnect
    socket.on("disconnect", () => {
      if (socket.clerkId) {
        unregister(socket.clerkId, socket.id);
        // Mark offline only if no other active sockets
        const remaining = userSockets.get(socket.clerkId);
        if (!remaining || remaining.size === 0) {
          User.findOneAndUpdate(
            { clerkId: socket.clerkId },
            { isOnline: false, lastSeen: new Date() }
          )
            .populate("friends", "clerkId")
            .then((user) => {
              if (!user) return;
              user.friends.forEach((f) =>
                emitToUser(f.clerkId, "friend-offline", { userId: user._id.toString() })
              );
            })
            .catch(() => {});
        }
      }

      if (socket.roomId && rooms.has(socket.roomId)) {
        rooms.get(socket.roomId).users.delete(socket.id);
        socket.to(socket.roomId).emit("user-disconnected", socket.id);

        if (rooms.get(socket.roomId).users.size === 0) {
          rooms.delete(socket.roomId);
        }
      }
    });

    socket.on("error", (error) => {
      console.error("Socket error:", error);
    });
  });
};

module.exports = setupSocket;
