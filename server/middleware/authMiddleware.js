// authMiddleware.js — enforces authentication on protected routes.
// clerkMiddleware() in server.js already parses the Bearer token and sets
// req.auth.userId, so we just need to check it here.
const authMiddleware = (req, res, next) => {
  const clerkId = req.auth?.userId || req.headers["x-clerk-id"];
  if (!clerkId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

module.exports = authMiddleware;
