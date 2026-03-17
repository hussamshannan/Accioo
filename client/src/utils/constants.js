export const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "😡", "🎉", "🤔", "👏", "🔥"];

export const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  // TURN server for NAT traversal — override via env vars or use free fallback
  ...(import.meta.env.VITE_TURN_URL
    ? [{
        urls: import.meta.env.VITE_TURN_URL,
        username: import.meta.env.VITE_TURN_USERNAME || "",
        credential: import.meta.env.VITE_TURN_CREDENTIAL || "",
      }]
    : [
        {
          urls: "turn:openrelay.metered.ca:80",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
        {
          urls: "turn:openrelay.metered.ca:443",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
        {
          urls: "turn:openrelay.metered.ca:443?transport=tcp",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
      ]),
];

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3001";
