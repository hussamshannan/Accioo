import { useEffect, useState, useCallback, useRef } from "react";

/**
 * Efficient hook to detect average brightness of page content
 * Uses event-based detection instead of intervals for better performance
 *
 * @param {React.RefObject|null} sourceRef - Optional video/img element to sample
 * @param {number} threshold - Brightness threshold (default 128)
 * @returns {boolean} - true if content is bright, false otherwise
 */
export function useBrightness(sourceRef = null, threshold = 128) {
  const [isBright, setIsBright] = useState(true);
  const observerRef = useRef(null);
  const canvasRef = useRef(null);
  const rafIdRef = useRef(null);
  const lastCheckRef = useRef(0);

  // Efficient brightness calculation
  const calculateBrightness = useCallback((imageData, sampleRate = 10) => {
    let total = 0;
    let sampleCount = 0;

    for (let i = 0; i < imageData.length; i += 4 * sampleRate) {
      const r = imageData[i];
      const g = imageData[i + 1];
      const b = imageData[i + 2];
      total += (r * 299 + g * 587 + b * 114) / 1000;
      sampleCount++;
    }

    return sampleCount > 0 ? total / sampleCount : 0;
  }, []);

  // Check brightness with optimized approach
  const checkBrightness = useCallback(() => {
    // Throttle checks to avoid performance issues
    const now = Date.now();
    if (now - lastCheckRef.current < 100) return; // Max 10 checks per second
    lastCheckRef.current = now;

    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
    }

    rafIdRef.current = requestAnimationFrame(() => {
      const src = sourceRef?.current;

      try {
        if (src && (src.tagName === "VIDEO" || src.tagName === "IMG")) {
          // Handle video or image elements
          if (!canvasRef.current) {
            canvasRef.current = document.createElement("canvas");
          }

          const canvas = canvasRef.current;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });

          // Use smaller dimensions for performance
          canvas.width = 100;
          canvas.height = 100;

          ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(
            0,
            0,
            canvas.width,
            canvas.height
          ).data;
          const avgBrightness = calculateBrightness(imageData, 5);
          setIsBright(avgBrightness > threshold);
        } else {
          // For page content, use a much more efficient approach
          // Sample the background color of the body and main content area
          const bodyStyle = getComputedStyle(document.body);
          const bodyBgColor = bodyStyle.backgroundColor;

          // Parse RGB from background color
          const rgbMatch = bodyBgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);

          if (rgbMatch) {
            const r = parseInt(rgbMatch[1]);
            const g = parseInt(rgbMatch[2]);
            const b = parseInt(rgbMatch[3]);
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            setIsBright(brightness > threshold);
          } else {
            // Fallback: check if the body has dark/light classes
            const bodyClasses = document.body.className;
            const isDark =
              bodyClasses.includes("dark") ||
              bodyClasses.includes("dark-mode") ||
              document.documentElement.getAttribute("data-theme") === "dark";
            setIsBright(!isDark);
          }
        }
      } catch (err) {
        console.warn("Brightness check failed:", err);
      }
    });
  }, [sourceRef, threshold, calculateBrightness]);

  useEffect(() => {
    // Set up observers and event listeners for dynamic updates
    if (!observerRef.current) {
      // Use MutationObserver to detect DOM changes that might affect brightness
      observerRef.current = new MutationObserver((mutations) => {
        // Check if any mutation might affect visual appearance
        const shouldCheck = mutations.some((mutation) => {
          // Check for attribute changes that might affect styling
          if (
            mutation.type === "attributes" &&
            (mutation.attributeName === "class" ||
              mutation.attributeName === "style")
          ) {
            return true;
          }

          // Check for added/removed nodes
          if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
            return true;
          }

          return false;
        });

        if (shouldCheck) {
          checkBrightness();
        }
      });

      observerRef.current.observe(document.body, {
        attributes: true,
        attributeFilter: ["class", "style"],
        childList: true,
        subtree: true,
      });
    }

    // Listen to media events if we have a media element
    const src = sourceRef?.current;
    if (src) {
      const mediaEvents = [
        "load",
        "loadstart",
        "timeupdate",
        "progress",
        "canplay",
        "play",
      ];
      mediaEvents.forEach((event) => {
        src.addEventListener(event, checkBrightness);
      });

      // Set up a periodic check for video (but less frequent than before)
      const videoInterval = setInterval(() => {
        if (src.tagName === "VIDEO" && !src.paused) {
          checkBrightness();
        }
      }, 500); // Check every 500ms for video, not every frame

      return () => {
        mediaEvents.forEach((event) => {
          src.removeEventListener(event, checkBrightness);
        });
        clearInterval(videoInterval);
      };
    }

    // Listen to window events that might affect brightness
    const windowEvents = ["resize", "scroll"];
    windowEvents.forEach((event) => {
      window.addEventListener(event, checkBrightness);
    });

    // Initial check
    checkBrightness();

    // Clean up
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      windowEvents.forEach((event) => {
        window.removeEventListener(event, checkBrightness);
      });
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [sourceRef, checkBrightness]);



  return isBright;
}
