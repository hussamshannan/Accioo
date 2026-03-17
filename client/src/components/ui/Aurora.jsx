import { useEffect, useRef } from "react";

export default function Aurora({
  colorStops = ["#00A884", "#128C7E", "#075E54"],
  blend = "screen",
  speed = 0.4,
  className = "",
}) {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      timeRef.current += speed * 0.01;
      const t = timeRef.current;
      const { width, height } = canvas;

      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = blend;

      colorStops.forEach((color, i) => {
        const x = width * (0.3 + 0.4 * Math.sin(t + i * 1.2));
        const y = height * (0.3 + 0.4 * Math.cos(t * 0.7 + i * 0.8));
        const r = Math.min(width, height) * (0.45 + 0.1 * Math.sin(t * 0.5 + i));
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, color + "CC");
        grad.addColorStop(1, color + "00");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      });

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [colorStops, blend, speed]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full ${className}`}
    />
  );
}
