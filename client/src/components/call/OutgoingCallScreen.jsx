import { useCall } from "@/contexts/CallContext";
import UserAvatar from "@/components/ui/UserAvatar";
import Grainient from "./Grainient";
import { Phone } from "lucide-react";

export default function OutgoingCallScreen() {
  const { callType, remoteUser, callState, endCall } = useCall();

  const label = callState === "connecting" ? "Connecting..." : "Calling...";
  const typeLabel = callType === "video" ? "Video Call" : "Voice Call";

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Background — fills entire screen */}
      {callType === "audio" && (
        <Grainient color1="#000000" color2="#000000" color3="#e1940e" />
      )}

      {/* Content overlay */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-between">
        {/* Caller info */}
        <div className="flex flex-col items-center justify-center flex-1 gap-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-full animate-pulse-ring bg-white/10" />
            <div className="absolute inset-[-8px] rounded-full animate-pulse-ring bg-white/5" style={{ animationDelay: "0.5s" }} />
            <UserAvatar user={remoteUser} size="2xl" showOnline={false} />
          </div>
          <h2 className="text-white text-xl font-semibold mt-4">
            {remoteUser?.displayName || remoteUser?.username || "Unknown"}
          </h2>
          <p className="text-white/60 text-sm">{typeLabel}</p>
          <p className="text-white/40 text-sm">{label}</p>
        </div>

        {/* End call button */}
        <div className="pb-16">
          <button
            onClick={endCall}
            className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-colors"
          >
            <Phone className="w-7 h-7 text-white rotate-[135deg]" />
          </button>
        </div>
      </div>
    </div>
  );
}
