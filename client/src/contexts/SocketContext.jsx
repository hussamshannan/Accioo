import { createContext, useContext, useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { useAuth as useClerkAuth } from "@clerk/react";
import { useAuth } from "./AuthContext";
import { SOCKET_URL } from "../utils/constants";

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { isSignedIn, clerkUser } = useAuth();
  const { getToken } = useClerkAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);
  const getTokenRef = useRef(getToken);

  // Keep getToken ref current without triggering socket recreation
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  // Stable clerkId — only changes on actual sign-in/out, not on object reference changes
  const clerkId = clerkUser?.id;

  useEffect(() => {
    if (!isSignedIn || !clerkId) {
      // Disconnect existing socket if user signs out
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const initSocket = async () => {
      // Get Clerk session token for auth
      let token = "";
      try {
        token = (await getTokenRef.current()) || "";
      } catch {
        // Token retrieval failed — socket will rely on clerkId
      }

      const newSocket = io(SOCKET_URL, {
        withCredentials: true,
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 60000,
        auth: {
          token,
          clerkId,
        },
      });

      newSocket.on("connect", () => {
        setIsConnected(true);
      });

      newSocket.on("disconnect", (reason) => {
        setIsConnected(false);
        if (reason === "io server disconnect") {
          newSocket.connect();
        }
      });

      newSocket.on("reconnect", () => {
        setIsConnected(true);
      });

      socketRef.current = newSocket;
      setSocket(newSocket);
    };

    initSocket();

    // Heartbeat
    const heartbeatInterval = setInterval(() => {
      if (socketRef.current?.connected) {
        socketRef.current.emit("heartbeat", { timestamp: Date.now() });
      }
    }, 45000);

    return () => {
      clearInterval(heartbeatInterval);
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [isSignedIn, clerkId]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
}
