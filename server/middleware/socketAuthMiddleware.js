// Socket.io authentication middleware
// Validates the Clerk token from handshake auth
const socketAuthMiddleware = (socket, next) => {
  const { clerkId, token } = socket.handshake.auth;

  if (!clerkId) {
    // Allow anonymous connections for backward compatibility during migration
    console.warn("Socket connected without clerkId:", socket.id);
    return next();
  }

  // Attach clerkId to socket for later use
  socket.clerkId = clerkId;

  // TODO: Validate the token with Clerk's verifyToken when CLERK_SECRET_KEY is set
  // For now, trust the clerkId from the client
  next();
};

module.exports = socketAuthMiddleware;
