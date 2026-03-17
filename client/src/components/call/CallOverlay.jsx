import { createPortal } from "react-dom";
import { useCall } from "@/contexts/CallContext";
import OutgoingCallScreen from "./OutgoingCallScreen";
import IncomingCallScreen from "./IncomingCallScreen";
import ActiveCallScreen from "./ActiveCallScreen";
import CallBanner from "./CallBanner";

export default function CallOverlay() {
  const { callState, isMinimized, remoteAudioRef } = useCall();

  if (callState === "idle") return null;

  let content = null;

  if (callState === "outgoing" || callState === "connecting") {
    content = <OutgoingCallScreen />;
  } else if (callState === "incoming") {
    content = <IncomingCallScreen />;
  } else if (callState === "active") {
    content = isMinimized ? <CallBanner /> : <ActiveCallScreen />;
  }

  return createPortal(
    <>
      {/* Hidden audio element — always present during calls so ontrack can attach */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: "none" }} />
      {content}
    </>,
    document.body
  );
}
