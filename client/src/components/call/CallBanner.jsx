import { useCall } from "@/contexts/CallContext";
import UserAvatar from "@/components/ui/UserAvatar";
import { Phone, MicOff } from "lucide-react";

function formatDuration(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return [hrs, mins, secs].map((v) => String(v).padStart(2, "0")).join(":");
  }
  return [mins, secs].map((v) => String(v).padStart(2, "0")).join(":");
}

export default function CallBanner() {
  const { remoteUser, callDuration, isMuted, endCall, toggleMinimize } = useCall();

  return (
    <div
      className="fixed top-3 left-1/2 -translate-x-1/2 z-50 max-w-[600px] w-[92%] rounded-full bg-black/40 backdrop-blur-xl border border-white/10 px-4 py-2 flex items-center gap-3 cursor-pointer shadow-lg"
      onClick={(e) => {
        // Don't expand if clicking the end button
        if (e.target.closest("[data-end-call]")) return;
        toggleMinimize();
      }}
    >
      <UserAvatar user={remoteUser} size="xs" showOnline={false} />
      <span className="text-white text-sm font-medium truncate flex-1">
        {remoteUser?.displayName || remoteUser?.username || "Unknown"}
      </span>
      <span className="text-white/60 text-xs font-mono">
        {formatDuration(callDuration)}
      </span>
      {isMuted && <MicOff className="w-4 h-4 text-red-300 shrink-0" />}
      <button
        data-end-call
        onClick={endCall}
        className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center shrink-0 hover:bg-red-600 transition-colors"
      >
        <Phone className="w-4 h-4 text-white rotate-[135deg]" />
      </button>
    </div>
  );
}
