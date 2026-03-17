import { createContext, useContext, useState, useRef, useEffect } from "react";
import { useSocket } from "./SocketContext";
import { useChat } from "./ChatContext";
import { ICE_SERVERS } from "../utils/constants";
import { v4 as uuidv4 } from "uuid";
import gsap from "gsap";

const CallContext = createContext(null);

export function CallProvider({ children }) {
  const { socket, isConnected } = useSocket();
  const { addSystemMessage } = useChat();

  const [isAudioActive, setIsAudioActive] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [peerConnection, setPeerConnection] = useState(null);
  const [isAnswer, setIsAnswer] = useState(null);
  const [callDuration, setCallDuration] = useState("00:00");

  const audioRef = useRef(null);
  const callIndicatorRef = useRef(null);
  const calltl = useRef(gsap.timeline({}));
  const answertl = useRef(gsap.timeline({}));

  // Initialize peer connection
  useEffect(() => {
    if (!socket) return;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    setPeerConnection(pc);

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
      if (audioRef.current) {
        audioRef.current.srcObject = event.streams[0];
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          candidate: event.candidate,
          roomId: socket.roomId,
        });
      }
    };

    return () => pc.close();
  }, [socket]);

  // Handle WebRTC signaling
  useEffect(() => {
    if (!socket) return;

    const handleCallStarted = (data) => {
      const startedBy = data.startedBy === "me";
      addSystemMessage(
        startedBy ? "You started the audio call" : "The other user started the audio call"
      );

      if (!startedBy && callIndicatorRef.current) {
        const svg = callIndicatorRef.current.querySelector("button>svg");
        gsap.killTweensOf(svg);
        gsap.set(svg, { clearProps: "all" });
        svg.classList.add("ringing");
        calltl.current.clear();
        calltl.current
          .to(svg, {
            rotate: 15, yoyo: true, repeat: -1, duration: 0.2,
            overwrite: "auto", ease: "power1.out",
          })
          .to(callIndicatorRef.current, {
            opacity: "1", filter: "blur(0px)", pointerEvents: "all",
            display: "flex", duration: 0.3, ease: "power1.out",
          });
      }
    };

    const handleCallEnded = (data) => {
      const endedByMe = data.endedBy === "me";
      setIsAnswer(false);
      setCallDuration("00:00");
      addSystemMessage(
        endedByMe ? "You ended the audio call" : "The other user ended the audio call"
      );

      if (callIndicatorRef.current) {
        gsap.to(callIndicatorRef.current, {
          opacity: "0", filter: "blur(var(--space-2))", pointerEvents: "none",
          display: "none", duration: 0.3, ease: "power1.out",
        });
      }

      if (remoteStream) {
        setRemoteStream(null);
        if (audioRef.current) audioRef.current.srcObject = null;
      }

      if (!endedByMe && localStream) {
        localStream.getTracks().forEach((track) => track.stop());
        setLocalStream(null);
        setIsAudioActive(false);
      }
    };

    const handleAudioOffer = async (data) => {
      if (peerConnection && localStream) {
        await peerConnection.setRemoteDescription(data.offer);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit("audio-answer", {
          answer, roomId: socket.roomId, to: data.from,
        });
      }
    };

    const handleAnswered = (data) => {
      if (data.isAnswer) {
        setIsAnswer(true);
        if (callIndicatorRef.current) {
          const svg = callIndicatorRef.current.querySelector("button>svg");
          gsap.killTweensOf(svg);
          gsap.set(svg, { clearProps: "all" });
          svg.classList.remove("ringing");
          calltl.current.clear();
          answertl.current.clear();
          answertl.current.to(svg, {
            rotate: 135, duration: 0.5, overwrite: "auto", ease: "power1.out",
          });
        }
      }
    };

    const handleAudioAnswer = async (data) => {
      if (peerConnection) {
        await peerConnection.setRemoteDescription(data.answer);
        socket.emit("answered", {
          isAnswer: true, roomId: socket.roomId, to: data.from,
        });
      }
    };

    const handleIceCandidate = async (data) => {
      if (peerConnection) {
        await peerConnection.addIceCandidate(data.candidate);
      }
    };

    socket.on("audio-call-started", handleCallStarted);
    socket.on("audio-call-ended", handleCallEnded);
    socket.on("audio-offer", handleAudioOffer);
    socket.on("audio-answer", handleAudioAnswer);
    socket.on("answered", handleAnswered);
    socket.on("ice-candidate", handleIceCandidate);

    return () => {
      socket.off("audio-call-started", handleCallStarted);
      socket.off("audio-call-ended", handleCallEnded);
      socket.off("audio-offer", handleAudioOffer);
      socket.off("audio-answer", handleAudioAnswer);
      socket.off("answered", handleAnswered);
      socket.off("ice-candidate", handleIceCandidate);
    };
  }, [socket, peerConnection, localStream, remoteStream]);

  // Call duration timer
  useEffect(() => {
    if (!isAnswer) return;

    let seconds = 0;
    const interval = setInterval(() => {
      seconds += 1;
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      const formatted =
        hrs > 0
          ? [hrs, mins, secs].map((v) => String(v).padStart(2, "0")).join(":")
          : [mins, secs].map((v) => String(v).padStart(2, "0")).join(":");
      setCallDuration(formatted);
    }, 1000);

    return () => clearInterval(interval);
  }, [isAnswer]);

  // End call on disconnect
  useEffect(() => {
    if (!isConnected && isAudioActive) {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
        setLocalStream(null);
      }
      setIsAudioActive(false);
      if (socket) socket.emit("audio-call-end", { roomId: socket.roomId });
    }
  }, [isConnected]);

  const toggleAudio = async (roomId) => {
    if (!isAudioActive) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true, video: false,
        });
        setLocalStream(stream);
        setIsAudioActive(true);

        if (peerConnection) {
          stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);

          if (socket?.connected) {
            socket.emit("audio-offer", { offer, roomId });
          }
        }

        if (socket?.connected) {
          socket.emit("audio-call-start", { roomId });
        }
      } catch (error) {
        console.error("Error accessing microphone:", error);
        addSystemMessage("Microphone access denied. Please check permissions.");
      }
    } else {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
        setLocalStream(null);
      }
      setIsAudioActive(false);
      if (socket?.connected) {
        socket.emit("audio-call-end", { roomId });
      }
    }
  };

  const toggleMute = (roomId) => {
    if (!localStream) return;
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    const newMuteState = !localStream.getAudioTracks()[0]?.enabled;
    setIsMuted(newMuteState);

    if (socket) {
      socket.emit("audio-mute-toggle", { roomId, isMuted: newMuteState });
    }
    addSystemMessage(
      newMuteState ? "You muted your microphone" : "You unmuted your microphone"
    );
  };

  return (
    <CallContext.Provider
      value={{
        isAudioActive,
        localStream,
        remoteStream,
        isMuted,
        isAnswer,
        callDuration,
        audioRef,
        callIndicatorRef,
        toggleAudio,
        toggleMute,
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
