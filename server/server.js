// server.js — Bootstrap only
require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { corsOptions, allowedOrigins } = require("./config/cors");
const connectDB = require("./config/db");
const { initCloudinary } = require("./config/cloudinary");
const errorHandler = require("./middleware/errorHandler");
const setupSocket = require("./socket");
const authRoutes = require("./routes/authRoutes");
const conversationRoutes = require("./routes/conversationRoutes");
const messageRoutes = require("./routes/messageRoutes");
const userRoutes = require("./routes/userRoutes");
const friendRoutes = require("./routes/friendRoutes");
const profileRoutes = require("./routes/profileRoutes");
const storyRoutes = require("./routes/storyRoutes");
const webhookRoutes = require("./routes/webhookRoutes");
const { startStoryCleanup } = require("./services/storyCleanupService");

const app = express();

// Middleware
app.use(cors(corsOptions));

// Webhook route must be registered BEFORE express.json() so the raw body
// is available for signature verification
app.use("/api/webhooks", webhookRoutes);

app.use(express.json());

// Apply Clerk globally so req.auth.userId is populated on all routes
// that carry a valid Bearer token, without blocking unauthenticated routes.
if (process.env.CLERK_SECRET_KEY) {
  const { clerkMiddleware, getAuth } = require("@clerk/express");
  app.use(clerkMiddleware({
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
  }));
  // Normalize: in @clerk/express v2 req.auth is a function; flatten to a plain object
  // so all controllers can use req.auth?.userId consistently.
  app.use((req, res, next) => {
    try {
      const authData = getAuth(req);
      req.auth = { userId: authData?.userId ?? null };
    } catch {
      req.auth = { userId: null };
    }
    next();
  });
}

// Routes
app.use("/api/auth", authRoutes);
// Note: /api/webhooks is already mounted above express.json()
app.use("/api/conversations", conversationRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/users", userRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/stories", storyRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

// HTTP + Socket.io server
const server = http.createServer(app);

const io = require("socket.io")(server, {
  pingTimeout: 60000,
  pingInterval: 25000,
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
  maxHttpBufferSize: 1e8, // 100MB
});

// Setup Socket.io handlers
setupSocket(io);

// Connect to MongoDB (non-blocking — server runs even if DB is unavailable)
connectDB();

// Initialize Cloudinary
initCloudinary();

// Start story cleanup cron
startStoryCleanup();

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

server.on("error", (error) => {
  console.error("Server error:", error);
});
