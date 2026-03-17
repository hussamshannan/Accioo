import { createContext, useContext, useReducer, useRef, useEffect, useCallback } from "react";
import { useSocket } from "./SocketContext";
import { useAuth } from "./AuthContext";
import { ICE_SERVERS } from "../utils/constants";
import { v4 as uuidv4 } from "uuid";

const CallContext = createContext(null);

// ─── Reducer ──────────────────────────────────────────────────────────────────
const initialState = {
  callState: "idle", // idle | outgoing | incoming | connecting | active
  callType: null, // audio | video
  callId: null,
  remoteUser: null, // { _id, displayName, username, avatarUrl }
  roomId: null,
  isMuted: false,
  isCameraOn: false,
  isSpeaker: true,
  isMinimized: false,
  callDuration: 0,
  remoteMuted: false,
  remoteCameraOn: true,
  error: null,
};

function callReducer(state, action) {
  switch (action.type) {
    case "INITIATE_CALL":
      return {
        ...initialState,
        callState: "outgoing",
        callType: action.payload.callType,
        callId: action.payload.callId,
        remoteUser: action.payload.remoteUser,
        roomId: action.payload.roomId,
        isCameraOn: action.payload.callType === "video",
        remoteCameraOn: action.payload.callType === "video",
      };
    case "INCOMING_CALL":
      return {
        ...initialState,
        callState: "incoming",
        callType: action.payload.callType,
        callId: action.payload.callId,
        remoteUser: action.payload.callerInfo,
        roomId: action.payload.roomId,
        remoteCameraOn: action.payload.callType === "video",
      };
    case "SET_CONNECTING":
      return { ...state, callState: "connecting" };
    case "SET_ACTIVE":
      return { ...state, callState: "active" };
    case "TOGGLE_MUTE":
      return { ...state, isMuted: !state.isMuted };
    case "TOGGLE_CAMERA":
      return { ...state, isCameraOn: !state.isCameraOn };
    case "TOGGLE_SPEAKER":
      return { ...state, isSpeaker: !state.isSpeaker };
    case "TOGGLE_MINIMIZE":
      return { ...state, isMinimized: !state.isMinimized };
    case "TICK_DURATION":
      return { ...state, callDuration: state.callDuration + 1 };
    case "REMOTE_MEDIA_TOGGLE":
      if (action.payload.kind === "audio") {
        return { ...state, remoteMuted: !action.payload.enabled };
      }
      return { ...state, remoteCameraOn: action.payload.enabled };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "RESET":
      return { ...initialState };
    default:
      return state;
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function CallProvider({ children }) {
  const { socket, isConnected } = useSocket();
  const { dbUser } = useAuth();
  const [state, dispatch] = useReducer(callReducer, initialState);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const iceCandidateBuffer = useRef([]);
  const timerRef = useRef(null);
  const stateRef = useRef(state);

  // Keep stateRef in sync
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const remoteStreamRef = useRef(null);

  // ─── Cleanup ──────────────────────────────────────────────────────────
  const cleanupCall = useCallback(() => {
    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Stop local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    // Close peer connection
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    // Clear ICE buffer
    iceCandidateBuffer.current = [];

    // Clear streams and video elements
    remoteStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;

    dispatch({ type: "RESET" });
  }, []);

  // ─── Start duration timer ─────────────────────────────────────────────
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      dispatch({ type: "TICK_DURATION" });
    }, 1000);
  }, []);

  // ─── Create PeerConnection ────────────────────────────────────────────
  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate && socket?.connected) {
        socket.emit("call:ice-candidate", {
          roomId: stateRef.current.roomId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (!stream) return;

      // Store stream so components can attach it when they mount
      remoteStreamRef.current = stream;

      // Attach immediately if elements already exist
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        dispatch({ type: "SET_ACTIVE" });
        startTimer();
      } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        // Connection lost
        if (stateRef.current.callState === "active") {
          socket?.emit("call:end", {
            roomId: stateRef.current.roomId,
            callId: stateRef.current.callId,
          });
          cleanupCall();
        }
      }
    };

    pcRef.current = pc;
    return pc;
  }, [socket, startTimer, cleanupCall]);

  // ─── Capture media ────────────────────────────────────────────────────
  const captureMedia = useCallback(async (callType) => {
    const constraints = {
      audio: true,
      video: callType === "video",
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    localStreamRef.current = stream;

    if (callType === "video" && localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    return stream;
  }, []);

  // ─── Flush ICE candidates ─────────────────────────────────────────────
  const flushIceCandidates = useCallback(async (pc) => {
    for (const candidate of iceCandidateBuffer.current) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (e) {
        console.warn("Failed to add buffered ICE candidate:", e);
      }
    }
    iceCandidateBuffer.current = [];
  }, []);

  // ─── Initiate Call ────────────────────────────────────────────────────
  const initiateCall = useCallback(
    async (roomId, callType, remoteUser) => {
      if (stateRef.current.callState !== "idle") return;

      const callId = uuidv4();

      try {
        // Capture media first
        await captureMedia(callType);
      } catch (err) {
        console.error("Failed to capture media:", err);
        dispatch({ type: "SET_ERROR", payload: "Could not access camera/microphone" });
        return;
      }

      dispatch({
        type: "INITIATE_CALL",
        payload: { callType, callId, remoteUser, roomId },
      });

      // Tell server to notify the other user — send OUR info as callerInfo + receiver's userId
      socket.emit("call:initiate", {
        roomId,
        callType,
        callId,
        receiverUserId: remoteUser?._id || null,
        callerInfo: dbUser
          ? {
              _id: dbUser._id,
              displayName: dbUser.displayName,
              username: dbUser.username,
              avatarUrl: dbUser.avatarUrl,
            }
          : null,
      });
    },
    [socket, captureMedia, dbUser]
  );

  // ─── Accept Call ──────────────────────────────────────────────────────
  const acceptCall = useCallback(async () => {
    if (stateRef.current.callState !== "incoming") return;
    const { roomId, callId, callType } = stateRef.current;

    dispatch({ type: "SET_CONNECTING" });

    try {
      const stream = await captureMedia(callType);
      const pc = createPeerConnection();

      // Add local tracks to PC
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Join the call's room so WebRTC signaling (offer/answer/ICE) can be relayed
      socket.emit("rejoin-room", { roomId });

      // Tell caller we accepted — they will create the offer
      socket.emit("call:accept", { roomId, callId });
    } catch (err) {
      console.error("Failed to accept call:", err);
      dispatch({ type: "SET_ERROR", payload: "Could not access camera/microphone" });
      socket.emit("call:reject", { roomId, callId });
      cleanupCall();
    }
  }, [socket, captureMedia, createPeerConnection, cleanupCall]);

  // ─── Reject Call ──────────────────────────────────────────────────────
  const rejectCall = useCallback(() => {
    if (stateRef.current.callState !== "incoming") return;
    const { roomId, callId } = stateRef.current;

    socket.emit("call:reject", { roomId, callId });
    cleanupCall();
  }, [socket, cleanupCall]);

  // ─── End Call ─────────────────────────────────────────────────────────
  const endCall = useCallback(() => {
    const { roomId, callId, callState } = stateRef.current;
    if (callState === "idle") return;

    socket?.emit("call:end", { roomId, callId });
    cleanupCall();
  }, [socket, cleanupCall]);

  // ─── Toggle Mute ──────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      dispatch({ type: "TOGGLE_MUTE" });
      socket?.emit("call:media-toggle", {
        roomId: stateRef.current.roomId,
        kind: "audio",
        enabled: audioTrack.enabled,
      });
    }
  }, [socket]);

  // ─── Toggle Camera ────────────────────────────────────────────────────
  const toggleCamera = useCallback(() => {
    if (!localStreamRef.current) return;
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      dispatch({ type: "TOGGLE_CAMERA" });
      socket?.emit("call:media-toggle", {
        roomId: stateRef.current.roomId,
        kind: "video",
        enabled: videoTrack.enabled,
      });
    }
  }, [socket]);

  // ─── Toggle Speaker ───────────────────────────────────────────────────
  const toggleSpeaker = useCallback(() => {
    dispatch({ type: "TOGGLE_SPEAKER" });
    // Toggle speaker on audio/video elements
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = state.isSpeaker; // will become !isSpeaker after dispatch
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = state.isSpeaker;
    }
  }, [state.isSpeaker]);

  // ─── Toggle Minimize ──────────────────────────────────────────────────
  const toggleMinimize = useCallback(() => {
    dispatch({ type: "TOGGLE_MINIMIZE" });
  }, []);

  // ─── Socket event listeners ───────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleIncoming = (data) => {
      // If already in a call, auto-reject
      if (stateRef.current.callState !== "idle") {
        socket.emit("call:reject", { roomId: data.roomId, callId: data.callId });
        return;
      }
      dispatch({
        type: "INCOMING_CALL",
        payload: data,
      });
    };

    const handleAccepted = async () => {
      // We are the caller — now create the offer
      const currentState = stateRef.current;
      if (currentState.callState !== "outgoing") return;

      dispatch({ type: "SET_CONNECTING" });

      const pc = createPeerConnection();
      const stream = localStreamRef.current;

      if (stream) {
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      }

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("call:webrtc-offer", {
          roomId: currentState.roomId,
          offer,
        });
      } catch (err) {
        console.error("Failed to create offer:", err);
        cleanupCall();
      }
    };

    const handleRejected = () => {
      cleanupCall();
    };

    const handleEnded = () => {
      cleanupCall();
    };

    const handleWebrtcOffer = async (data) => {
      // We are the receiver
      const pc = pcRef.current;
      if (!pc) return;

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        await flushIceCandidates(pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit("call:webrtc-answer", {
          roomId: stateRef.current.roomId,
          answer,
        });
      } catch (err) {
        console.error("Failed to handle offer:", err);
      }
    };

    const handleWebrtcAnswer = async (data) => {
      const pc = pcRef.current;
      if (!pc) return;

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        await flushIceCandidates(pc);
      } catch (err) {
        console.error("Failed to handle answer:", err);
      }
    };

    const handleIceCandidate = async (data) => {
      const pc = pcRef.current;
      if (!pc || !pc.remoteDescription) {
        // Buffer candidate until remote description is set
        iceCandidateBuffer.current.push(new RTCIceCandidate(data.candidate));
        return;
      }
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        console.warn("Failed to add ICE candidate:", err);
      }
    };

    const handleMediaToggle = (data) => {
      dispatch({ type: "REMOTE_MEDIA_TOGGLE", payload: data });
    };

    const handleError = (data) => {
      dispatch({ type: "SET_ERROR", payload: data.message });
    };

    socket.on("call:incoming", handleIncoming);
    socket.on("call:accepted", handleAccepted);
    socket.on("call:rejected", handleRejected);
    socket.on("call:ended", handleEnded);
    socket.on("call:webrtc-offer", handleWebrtcOffer);
    socket.on("call:webrtc-answer", handleWebrtcAnswer);
    socket.on("call:ice-candidate", handleIceCandidate);
    socket.on("call:media-toggle", handleMediaToggle);
    socket.on("call:error", handleError);

    return () => {
      socket.off("call:incoming", handleIncoming);
      socket.off("call:accepted", handleAccepted);
      socket.off("call:rejected", handleRejected);
      socket.off("call:ended", handleEnded);
      socket.off("call:webrtc-offer", handleWebrtcOffer);
      socket.off("call:webrtc-answer", handleWebrtcAnswer);
      socket.off("call:ice-candidate", handleIceCandidate);
      socket.off("call:media-toggle", handleMediaToggle);
      socket.off("call:error", handleError);
    };
  }, [socket, createPeerConnection, flushIceCandidates, cleanupCall]);

  // Cleanup on disconnect
  useEffect(() => {
    if (!isConnected && stateRef.current.callState !== "idle") {
      cleanupCall();
    }
  }, [isConnected, cleanupCall]);

  return (
    <CallContext.Provider
      value={{
        // State
        callState: state.callState,
        callType: state.callType,
        callId: state.callId,
        remoteUser: state.remoteUser,
        isMuted: state.isMuted,
        isCameraOn: state.isCameraOn,
        isSpeaker: state.isSpeaker,
        isMinimized: state.isMinimized,
        callDuration: state.callDuration,
        remoteMuted: state.remoteMuted,
        remoteCameraOn: state.remoteCameraOn,
        error: state.error,
        // Refs
        localVideoRef,
        remoteVideoRef,
        remoteAudioRef,
        localStreamRef,
        remoteStreamRef,
        // Actions
        initiateCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleCamera,
        toggleSpeaker,
        toggleMinimize,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCall must be used within a CallProvider");
  }
  return context;
}
