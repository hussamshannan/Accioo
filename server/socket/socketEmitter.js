// socketEmitter.js — lets HTTP controllers emit socket events
// clerkId → Set of socketIds
const userSockets = new Map();

let _io = null;

const init = (io) => {
  _io = io;
};

const register = (clerkId, socketId) => {
  if (!clerkId) return;
  if (!userSockets.has(clerkId)) userSockets.set(clerkId, new Set());
  userSockets.get(clerkId).add(socketId);
};

const unregister = (clerkId, socketId) => {
  if (!clerkId || !userSockets.has(clerkId)) return;
  userSockets.get(clerkId).delete(socketId);
  if (userSockets.get(clerkId).size === 0) userSockets.delete(clerkId);
};

const emitToUser = (clerkId, event, data) => {
  if (!_io || !clerkId) return;
  const socketIds = userSockets.get(clerkId);
  if (!socketIds) return;
  for (const socketId of socketIds) {
    _io.to(socketId).emit(event, data);
  }
};

module.exports = { init, register, unregister, emitToUser, userSockets };
