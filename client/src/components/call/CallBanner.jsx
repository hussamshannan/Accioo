import { useCallback, useEffect, useRef, useState } from "react";
import { useCall } from "@/contexts/CallContext";
import UserAvatar from "@/components/ui/UserAvatar";
import { Phone, MicOff } from "lucide-react";

const EDGE_MARGIN = 12;
const TAP_THRESHOLD_PX = 6;

function formatDuration(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return [hrs, mins, secs].map((v) => String(v).padStart(2, "0")).join(":");
  }
  return [mins, secs].map((v) => String(v).padStart(2, "0")).join(":");
}

function restingX(side, bannerWidth, viewportWidth) {
  return side === "left" ? EDGE_MARGIN : viewportWidth - bannerWidth - EDGE_MARGIN;
}

function clampY(y, bannerHeight, viewportHeight) {
  const min = EDGE_MARGIN;
  const max = Math.max(min, viewportHeight - bannerHeight - EDGE_MARGIN);
  return Math.min(Math.max(y, min), max);
}

export default function CallBanner() {
  const {
    remoteUser,
    callType,
    callDuration,
    isMuted,
    remoteCameraOn,
    remoteVideoRef,
    remoteStreamRef,
    endCall,
    toggleMinimize,
    bannerPosition,
    setBannerPosition,
  } = useCall();

  const isVideoCall = callType === "video";

  // Same pattern as ActiveCallScreen: reassign the shared remoteVideoRef so
  // pc.ontrack in CallContext can attach the stream to whichever <video>
  // is currently mounted (banner or full screen).
  const remoteVideoCallbackRef = useCallback(
    (el) => {
      remoteVideoRef.current = el;
      if (el && remoteStreamRef.current) {
        el.srcObject = remoteStreamRef.current;
      }
    },
    [remoteVideoRef, remoteStreamRef]
  );

  const bannerRef = useRef(null);
  const dragRef = useRef({
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    maxMove: 0,
    pointerId: null,
  });

  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  // Hide until first layout so we never flash at (0,0) before measuring
  const [ready, setReady] = useState(false);

  // Place the banner on mount and whenever the viewport changes.
  // We read offsetWidth/Height after the element is mounted so the math is exact.
  useEffect(() => {
    const place = () => {
      const el = bannerRef.current;
      if (!el) return;
      const w = el.offsetWidth || 72;
      const h = el.offsetHeight || 140;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const side = bannerPosition?.side === "left" ? "left" : "right";
      const defaultY = Math.round(vh * 0.35);
      const y = clampY(bannerPosition?.topPx ?? defaultY, h, vh);
      setPos({ x: restingX(side, w, vw), y });
      setReady(true);
    };

    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [bannerPosition?.side, bannerPosition?.topPx]);

  const handlePointerDown = useCallback((e) => {
    if (e.target.closest("[data-end-call]")) return;
    const el = bannerRef.current;
    if (!el) return;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // Some browsers throw if the pointer is no longer active
    }
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: pos.x,
      originY: pos.y,
      maxMove: 0,
      pointerId: e.pointerId,
    };
    setIsDragging(true);
  }, [pos.x, pos.y]);

  const handlePointerMove = useCallback((e) => {
    if (dragRef.current.pointerId !== e.pointerId) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    dragRef.current.maxMove = Math.max(
      dragRef.current.maxMove,
      Math.hypot(dx, dy)
    );
    setPos({
      x: dragRef.current.originX + dx,
      y: dragRef.current.originY + dy,
    });
  }, []);

  const finishDrag = useCallback((e) => {
    if (dragRef.current.pointerId !== e.pointerId) return;
    const el = bannerRef.current;
    if (el) {
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
    setIsDragging(false);

    const moved = dragRef.current.maxMove;
    dragRef.current.pointerId = null;

    if (moved < TAP_THRESHOLD_PX) {
      toggleMinimize();
      return;
    }

    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const centerX = pos.x + w / 2;
    const nextSide = centerX < vw / 2 ? "left" : "right";
    const snappedY = clampY(pos.y, h, vh);

    setPos({ x: restingX(nextSide, w, vw), y: snappedY });
    setBannerPosition({ side: nextSide, topPx: snappedY });
  }, [pos.x, pos.y, toggleMinimize, setBannerPosition]);

  const stopEndButtonPointer = useCallback((e) => {
    e.stopPropagation();
  }, []);

  return (
    <div
      ref={bannerRef}
      style={{
        left: pos.x,
        top: pos.y,
        touchAction: "none",
        transition: isDragging
          ? "none"
          : "left 220ms ease-out, top 220ms ease-out",
        visibility: ready ? "visible" : "hidden",
      }}
      className="fixed z-50 flex flex-col items-center gap-2 px-2 py-3 rounded-3xl bg-black/50 backdrop-blur-xl border border-white/10 shadow-lg select-none cursor-grab active:cursor-grabbing"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
    >
      {isVideoCall ? (
        <div className="w-24 h-28 rounded-2xl overflow-hidden bg-black/40 flex items-center justify-center relative">
          <video
            ref={remoteVideoCallbackRef}
            autoPlay
            playsInline
            muted
            disablePictureInPicture
            style={{
              pointerEvents: "none",
              display: remoteCameraOn ? "block" : "none",
            }}
            className="w-full h-full object-cover"
          />
          {!remoteCameraOn && (
            <UserAvatar user={remoteUser} size="lg" showOnline={false} />
          )}
        </div>
      ) : (
        <UserAvatar user={remoteUser} size="sm" showOnline={false} />
      )}
      <span className="text-white text-[10px] font-mono tabular-nums leading-none">
        {formatDuration(callDuration)}
      </span>
      {isMuted && <MicOff className="w-3 h-3 text-red-300" />}
      <button
        data-end-call
        onPointerDown={stopEndButtonPointer}
        onClick={(e) => {
          e.stopPropagation();
          endCall();
        }}
        className="w-9 h-9 rounded-full bg-red-500 flex items-center justify-center shrink-0 hover:bg-red-600 transition-colors"
        aria-label="End call"
      >
        <Phone className="w-4 h-4 text-white rotate-[135deg]" />
      </button>
    </div>
  );
}
