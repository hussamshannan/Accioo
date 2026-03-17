export const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "😡", "🎉", "🤔", "👏", "🔥"];

export const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  // Optional TURN server via env vars for NAT traversal
  ...(import.meta.env.VITE_TURN_URL
    ? [{
        urls: import.meta.env.VITE_TURN_URL,
        username: import.meta.env.VITE_TURN_USERNAME || "",
        credential: import.meta.env.VITE_TURN_CREDENTIAL || "",
      }]
    : []),
];

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3001";
