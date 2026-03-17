import React, { useEffect, useRef, useState } from "react";

// Module-level WeakMap so a single AudioContext is reused across re-mounts
// for the same HTMLAudioElement (createMediaElementSource can only be called once per element).
const elementContexts = new WeakMap();

function getOrCreateElementContext(el) {
  if (elementContexts.has(el)) return elementContexts.get(el);
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  const analyser = ctx.createAnalyser();
  const source = ctx.createMediaElementSource(el);
  source.connect(analyser);
  source.connect(ctx.destination); // keep audio audible
  analyser.fftSize = 256;
  const entry = { ctx, analyser };
  elementContexts.set(el, entry);
  return entry;
}

const VoiceVisualizer = ({ audioStream, audioElement, isBright }) => {
  const [barHeights, setBarHeights] = useState(Array(9).fill(0));
  const animationRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);

  useEffect(() => {
    let audioContextRef = null; // only for stream mode (needs close on unmount)

    const startAnimation = (analyser, bufferLength) => {
      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(bufferLength);

      const animate = () => {
        if (!analyserRef.current || !dataArrayRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        const newBarHeights = Array(10).fill(0);
        const valuesPerBar = Math.floor(bufferLength / 10);
        for (let i = 0; i < 10; i++) {
          let sum = 0;
          for (let j = 0; j < valuesPerBar; j++) {
            sum += dataArrayRef.current[i * valuesPerBar + j];
          }
          newBarHeights[i] = Math.min(100, (sum / valuesPerBar) * 0.5);
        }
        setBarHeights(newBarHeights);
        animationRef.current = requestAnimationFrame(animate);
      };
      animate();
    };

    if (audioElement) {
      // Skip visualization for blob URLs (still uploading) or empty src
      if (!audioElement.src || audioElement.src.startsWith("blob:")) return;
      try {
        const { ctx, analyser } = getOrCreateElementContext(audioElement);
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
        startAnimation(analyser, analyser.frequencyBinCount);
      } catch {
        // createMediaElementSource already called on a different context — degrade gracefully
      }
    } else if (audioStream) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef = ctx;
      const analyser = ctx.createAnalyser();
      const source = ctx.createMediaStreamSource(audioStream);
      source.connect(analyser);
      analyser.fftSize = 256;
      startAnimation(analyser, analyser.frequencyBinCount);
    }

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioContextRef) audioContextRef.close();
      setBarHeights(Array(9).fill(0));
    };
  }, [audioStream, audioElement]);

  const barColor = isBright ? "var(--svg-fill)" : "var(--svg-fill-light)";

  const mirroredBars = [];
  for (let i = 4; i > 0; i--) {
    mirroredBars.push(
      <div key={`left-${i}`} className="voice-bar" style={{ height: `${barHeights[i]}%`, background: barColor }} />
    );
  }
  for (let i = 0; i <= 4; i++) {
    mirroredBars.push(
      <div key={`right-${i}`} className="voice-bar" style={{ height: `${barHeights[i]}%`, background: barColor }} />
    );
  }

  return <div className="voice-visualizer mirrored">{mirroredBars}</div>;
};

export default VoiceVisualizer;
