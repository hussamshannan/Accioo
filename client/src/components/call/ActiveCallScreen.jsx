import { useEffect } from "react";
import { useCall } from "@/contexts/CallContext";
import UserAvatar from "@/components/ui/UserAvatar";
import VoiceVisualizer from "@/components/VoiceVisualizer";
import Grainient from "./Grainient";
import {
  Mic,
  MicOff,
  Phone,
  Video,
  VideoOff,
  Volume2,
  VolumeOff,
  ChevronDown,
} from "lucide-react";

function formatDuration(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return [hrs, mins, secs].map((v) => String(v).padStart(2, "0")).join(":");
  }
  return [mins, secs].map((v) => String(v).padStart(2, "0")).join(":");
}

export default function ActiveCallScreen() {
  const {
    callType,
    remoteUser,
    callDuration,
    isMuted,
    isCameraOn,
    isSpeaker,
    remoteMuted,
    remoteCameraOn,
    localVideoRef,
    remoteVideoRef,
    localStreamRef,
    remoteStreamRef,
    endCall,
    toggleMute,
    toggleCamera,
    toggleSpeaker,
    toggleMinimize,
  } = useCall();

  const isVideo = callType === "video";

  // Attach stored streams to video elements when this component mounts
  // (captureMedia / ontrack may have fired before this component existed)
  useEffect(() => {
    if (remoteStreamRef.current && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
    }
    if (localStreamRef.current && localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [remoteStreamRef, remoteVideoRef, localStreamRef, localVideoRef]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {isVideo ? (
        <>
          {/* Remote video — always mounted so ontrack stream persists */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
            style={{ display: remoteCameraOn ? "block" : "none" }}
          />
          {!remoteCameraOn && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black gap-3">
              <UserAvatar user={remoteUser} size="2xl" showOnline={false} />
              <p className="text-white/40 text-sm">Camera Off</p>
            </div>
          )}

          {/* Local video PiP — always mounted so srcObject persists across toggles */}
          <div className="absolute bottom-28 right-4 w-32 h-44 rounded-2xl overflow-hidden border-2 border-white/20 bg-black z-10">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: "scaleX(-1)", display: isCameraOn ? "block" : "none" }}
            />
            {!isCameraOn && (
              <div className="w-full h-full flex items-center justify-center bg-gray-900">
                <VideoOff className="w-6 h-6 text-white/40" />
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Audio call background */}
          <Grainient color1="#000000" color2="#000000" color3="#e1940e" />
          <div className="relative z-10 flex flex-col items-center justify-center flex-1 gap-4">
            <UserAvatar user={remoteUser} size="2xl" showOnline={false} />
            <h2 className="text-white text-xl font-semibold">
              {remoteUser?.displayName || remoteUser?.username || "Unknown"}
            </h2>
            <p className="text-white/60 text-sm font-mono">
              {formatDuration(callDuration)}
            </p>
            {/* Voice Visualizer */}
            <div className="w-48 h-12">
              <VoiceVisualizer audioStream={localStreamRef?.current} isBright={false} />
            </div>
          </div>
        </>
      )}

      {/* Top bar — name + timer (video calls) */}
      {isVideo && (
        <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-12 pb-4 bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold">
                {remoteUser?.displayName || remoteUser?.username || "Unknown"}
              </h3>
              <p className="text-white/60 text-xs font-mono">
                {formatDuration(callDuration)}
              </p>
            </div>
            {remoteMuted && (
              <div className="flex items-center gap-1 bg-white/10 rounded-full px-2 py-1">
                <MicOff className="w-3 h-3 text-red-400" />
                <span className="text-xs text-red-400">Muted</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Remote muted badge (audio calls) */}
      {!isVideo && remoteMuted && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-white/10 rounded-full px-3 py-1">
          <MicOff className="w-3 h-3 text-red-400" />
          <span className="text-xs text-red-400">Muted</span>
        </div>
      )}

      {/* Control bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20 pb-12 pt-6 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-center gap-6">
          {/* Mute */}
          <button
            onClick={toggleMute}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              isMuted ? "bg-red-500" : "bg-white/20"
            }`}
          >
            {isMuted ? (
              <MicOff className="w-5 h-5 text-white" />
            ) : (
              <Mic className="w-5 h-5 text-white" />
            )}
          </button>

          {/* Camera toggle (video only) */}
          {isVideo && (
            <button
              onClick={toggleCamera}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                !isCameraOn ? "bg-red-500" : "bg-white/20"
              }`}
            >
              {isCameraOn ? (
                <Video className="w-5 h-5 text-white" />
              ) : (
                <VideoOff className="w-5 h-5 text-white" />
              )}
            </button>
          )}

          {/* Speaker */}
          <button
            onClick={toggleSpeaker}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              !isSpeaker ? "bg-red-500" : "bg-white/20"
            }`}
          >
            {isSpeaker ? (
              <Volume2 className="w-5 h-5 text-white" />
            ) : (
              <VolumeOff className="w-5 h-5 text-white" />
            )}
          </button>

          {/* End call */}
          <button
            onClick={endCall}
            className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-colors"
          >
            <Phone className="w-6 h-6 text-white rotate-[135deg]" />
          </button>

          {/* Minimize */}
          <button
            onClick={toggleMinimize}
            className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center transition-colors"
          >
            <ChevronDown className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
