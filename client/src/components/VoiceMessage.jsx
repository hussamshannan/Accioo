import { useEffect, useRef, useState, useMemo } from "react";

/**
 * WhatsApp-style voice message player.
 * Static waveform bars whose fill color sweeps left→right as audio progresses.
 * No AudioContext / createMediaElementSource — just a plain HTMLAudioElement.
 */

const BAR_COUNT = 28;

// Deterministic pseudo-random heights seeded from message ID
function generateBars(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  const bars = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    h = (h * 16807 + 7) | 0;
    const v = (Math.abs(h) % 80) + 20; // 20–100
    bars.push(v);
  }
  return bars;
}

function formatDuration(s) {
  if (!s || !isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function VoiceMessage({ msgId, audioUrl, duration = 0, isUploading, isMe, isBright }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0–1
  const [currentTime, setCurrent] = useState(0);
  const [totalDuration, setTotal] = useState(duration);
  const playerRef = useRef(null);
  const bars = useMemo(() => generateBars(msgId || "default"), [msgId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      playerRef.current?.pause();
      playerRef.current = null;
    };
  }, []);

  // Reset when audioUrl changes (placeholder → cloudinary)
  useEffect(() => {
    if (playerRef.current && playerRef.current._src !== audioUrl) {
      playerRef.current.pause();
      playerRef.current = null;
      setPlaying(false);
      setProgress(0);
      setCurrent(0);
    }
  }, [audioUrl]);

  const getPlayer = () => {
    if (playerRef.current && playerRef.current._src === audioUrl) return playerRef.current;
    const p = new Audio(audioUrl);
    p._src = audioUrl; // track which URL this player was created for
    p.onloadedmetadata = () => setTotal(p.duration || duration);
    p.ontimeupdate = () => {
      if (p.duration) {
        setProgress(p.currentTime / p.duration);
        setCurrent(p.currentTime);
      }
    };
    p.onended = () => {
      setPlaying(false);
      setProgress(0);
      setCurrent(0);
    };
    playerRef.current = p;
    return p;
  };

  const toggle = (e) => {
    e.stopPropagation();
    if (!audioUrl || audioUrl.startsWith("blob:") || isUploading) return;
    const p = getPlayer();
    if (playing) {
      p.pause();
      setPlaying(false);
    } else {
      p.play().then(() => setPlaying(true)).catch(() => {});
    }
  };

  const seek = (e) => {
    e.stopPropagation();
    if (!audioUrl || audioUrl.startsWith("blob:") || isUploading) return;
    const p = getPlayer();
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (p.duration) {
      p.currentTime = pct * p.duration;
      setProgress(pct);
      setCurrent(p.currentTime);
    }
  };

  const playedColor = isMe ? "rgba(255,255,255,0.85)" : "#00A884";
  const unplayedColor = isMe ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.18)";

  return (
    <div className="voice-msg">
      {/* Play / Pause button */}
      <button className="voice-msg-btn" onClick={toggle} disabled={isUploading}>
        {isUploading ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" />
            <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor">
              <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" />
            </path>
          </svg>
        ) : playing ? (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <polygon points="6,3 20,12 6,21" />
          </svg>
        )}
      </button>

      {/* Waveform + time */}
      <div className="voice-msg-body">
        <div className="voice-msg-wave" onClick={seek}>
          {bars.map((h, i) => {
            const filled = i / BAR_COUNT < progress;
            return (
              <span
                key={i}
                className="voice-msg-bar"
                style={{
                  height: `${h}%`,
                  background: filled ? playedColor : unplayedColor,
                }}
              />
            );
          })}
        </div>
        <div className="voice-msg-meta">
          <span className="voice-msg-time">
            {playing || currentTime > 0
              ? formatDuration(currentTime)
              : formatDuration(totalDuration)}
          </span>
          <span className="voice-msg-mic">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" opacity="0.45">
              <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}
