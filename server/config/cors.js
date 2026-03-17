const allowedOrigins = [
  "https://joichat.netlify.app",
  "http://localhost:5173",
  "http://localhost:3001",
];

const corsOptions = {
  origin: allowedOrigins,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  credentials: true,
};

module.exports = { allowedOrigins, corsOptions };
