import { useEffect, useRef } from "react";
import { useCall } from "@/contexts/CallContext";
import UserAvatar from "@/components/ui/UserAvatar";
import Grainient from "./Grainient";
import { Phone, PhoneOff } from "lucide-react";
import gsap from "gsap";

export default function IncomingCallScreen() {
  const { callType, remoteUser, acceptCall, rejectCall } = useCall();
  const containerRef = useRef(null);

  const typeLabel = callType === "video" ? "Incoming Video Call" : "Incoming Voice Call";

  // GSAP entrance animation
  useEffect(() => {
    if (!containerRef.current) return;
    gsap.fromTo(
      containerRef.current,
      { scale: 0.95, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.3, ease: "power2.out" }
    );
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black/90"
    >
      {/* Background */}
      {callType === "audio" && (
        <Grainient color1="#000000" color2="#000000" color3="#e1940e" />
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center flex-1 gap-4">
        <div className="relative">
          <div className="absolute inset-0 rounded-full animate-pulse-ring bg-white/10" />
          <div className="absolute inset-[-8px] rounded-full animate-pulse-ring bg-white/5" style={{ animationDelay: "0.5s" }} />
          <UserAvatar user={remoteUser} size="2xl" showOnline={false} />
        </div>
        <h2 className="text-white text-xl font-semibold mt-4">
          {remoteUser?.displayName || remoteUser?.username || "Unknown"}
        </h2>
        <p className="text-white/60 text-sm">{typeLabel}</p>
      </div>

      {/* Accept / Reject buttons */}
      <div className="relative z-10 flex items-center gap-16 pb-16">
        <button
          onClick={rejectCall}
          className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-colors"
        >
          <PhoneOff className="w-7 h-7 text-white" />
        </button>
        <button
          onClick={acceptCall}
          className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center hover:bg-green-600 transition-colors"
        >
          <Phone className="w-7 h-7 text-white" />
        </button>
      </div>
    </div>
  );
}
