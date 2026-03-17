import { useState, useEffect, useRef, useCallback } from "react";
import ColorThief from "colorthief";

export function usePrimaryColor(imgRef = null, reRunOnResize = true) {
  const [color, setColor] = useState({ rgb: "rgb(0,0,0)", hex: "#000000" });
  const observerRef = useRef(null);
  const colorThiefRef = useRef(new ColorThief());

  const rgbToHex = (r, g, b) =>
    `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;

const analyzeColor = useCallback(() => {
  try {
    const img = imgRef?.current;
    if (!img) return;

    // Check if image is loaded and has dimensions
    if (!img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) {
      console.warn("Image not ready or has zero size, retrying...");
      return;
    }

    // Ensure CORS
    if (!img.crossOrigin) img.crossOrigin = "anonymous";

    const [r, g, b] = colorThiefRef.current.getColor(img);
    const rgb = `rgb(${r}, ${g}, ${b})`;
    const hex = rgbToHex(r, g, b);

    setColor({ rgb, hex });
  } catch (err) {
    console.error("Failed to get dominant color:", err);
  }
}, [imgRef]);


  useEffect(() => {
    if (!imgRef?.current) return;

    // Initial analysis
    analyzeColor();

    // Handle image load event
    const img = imgRef.current;
    img.addEventListener("load", analyzeColor);

    // Resize handler
    if (reRunOnResize) {
      window.addEventListener("resize", analyzeColor);
    }

    // MutationObserver for attribute changes
    observerRef.current = new MutationObserver(analyzeColor);
    observerRef.current.observe(img, {
      attributes: true,
      attributeFilter: ["src", "style", "class"],
    });

    return () => {
      img.removeEventListener("load", analyzeColor);
      observerRef.current?.disconnect();
      if (reRunOnResize) {
        window.removeEventListener("resize", analyzeColor);
      }
    };
  }, [imgRef, analyzeColor, reRunOnResize]);

  return color;
}
