import { createContext, useContext, useEffect, useState, useRef } from "react";
import defaultImg from "../assets/images/frank-huang-WxQdHLGT7s8-unsplash.jpg";

const ThemeContext = createContext(null);

const LIGHT_VARS = {
  "--background": "#ffffff",
  "--foreground": "#0a0a0a",
  "--card": "#ffffff",
  "--card-foreground": "#0a0a0a",
  "--popover": "#ffffff",
  "--popover-foreground": "#0a0a0a",
  "--primary": "#00A884",
  "--primary-foreground": "#ffffff",
  "--secondary": "#f5f5f5",
  "--secondary-foreground": "#171717",
  "--muted": "#f5f5f5",
  "--muted-foreground": "#737373",
  "--accent": "#f5f5f5",
  "--accent-foreground": "#171717",
  "--destructive": "#e7000b",
  "--destructive-foreground": "#fafafa",
  "--border": "#e5e5e5",
  "--input": "#e5e5e5",
  "--ring": "#a1a1a1",
  "--radius": "0.625rem",
  "--bubble-sent": "#EFFDDE",
  "--bubble-received": "#FFFFFF",
  "--bubble-sent-fg": "#0a0a0a",
  "--bubble-received-fg": "#0a0a0a",
  "--chat-bg": "#EFE7DA",
  "--body-bg-clr-frosted": "rgba(255,255,255,0.82)",
  // ChatPage legacy vars
  "--primary-clr": "#00A884",
  "--svg-fill": "#0a0a0a",
  "--svg-fill-light": "#fafafa",
  "--svg-fill-seen": "#00A884",
  "--body-bg-clr": "#ffffff",
  "--body-bg-clr-gray": "#f5f5f5",
  "--body-bg-clr-transparent": "#e5e5e5",
  "--txt-clr": "#0a0a0a",
  "--txt-clr-dark": "#737373",
  "--txt-clr-disabled": "#a1a1a1",
  "--txt-clr-light": "#fafafa",
  "--accent-clr": "#e5e5e5",
};

const DARK_VARS = {
  "--background": "#0a0a0a",
  "--foreground": "#fafafa",
  "--card": "#171717",
  "--card-foreground": "#fafafa",
  "--popover": "#171717",
  "--popover-foreground": "#fafafa",
  "--primary": "#00A884",
  "--primary-foreground": "#ffffff",
  "--secondary": "#262626",
  "--secondary-foreground": "#fafafa",
  "--muted": "#262626",
  "--muted-foreground": "#a1a1a1",
  "--accent": "#262626",
  "--accent-foreground": "#fafafa",
  "--destructive": "#ff6467",
  "--destructive-foreground": "#fafafa",
  "--border": "#282828",
  "--input": "#343434",
  "--ring": "#737373",
  "--radius": "0.625rem",
  "--bubble-sent": "#2B5278",
  "--bubble-received": "#182533",
  "--bubble-sent-fg": "#fafafa",
  "--bubble-received-fg": "#fafafa",
  "--chat-bg": "#17212B",
  "--body-bg-clr-frosted": "rgba(17,27,33,0.82)",
  // ChatPage legacy vars
  "--primary-clr": "#00A884",
  "--svg-fill": "#fafafa",
  "--svg-fill-light": "#fafafa",
  "--svg-fill-seen": "#00A884",
  "--body-bg-clr": "#111B21",
  "--body-bg-clr-gray": "#1F2C34",
  "--body-bg-clr-transparent": "#262626",
  "--txt-clr": "#fafafa",
  "--txt-clr-dark": "#a1a1a1",
  "--txt-clr-disabled": "#737373",
  "--txt-clr-light": "#fafafa",
  "--accent-clr": "#2A3942",
};

function applyVars(vars, dark) {
  const el = document.documentElement;
  Object.entries(vars).forEach(([k, v]) => el.style.setProperty(k, v));
  el.classList.toggle("dark", dark);
}

const getDeviceDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

export function ThemeProvider({ children }) {
  // "system" | "light" | "dark"
  const [themeMode, setThemeModeState] = useState(() => {
    const saved = localStorage.getItem("themeMode");
    // Migrate legacy values and wipe them so device preference takes over
    if (saved === "solid-dark" || saved === "light" || saved === "dark") {
      localStorage.removeItem("themeMode");
    }
    return "system"; // always start following device
  });

  // The actual resolved dark/light value (used for applying vars)
  const [isDark, setIsDark] = useState(() => getDeviceDark());

  const [bgimage, setBgimage] = useState(null);
  const [videoOn, setVideoOn] = useState(false);
  const videoRef = useRef(null);
  const bgimageRef = useRef(null);

  // When themeMode changes, recalculate isDark (no localStorage persistence — always resets to device on reload)
  useEffect(() => {
    if (themeMode === "system") {
      setIsDark(getDeviceDark());
    } else {
      setIsDark(themeMode === "dark");
    }
  }, [themeMode]);

  // Listen to OS theme changes when in "system" mode
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => {
      if (themeMode === "system") setIsDark(e.matches);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [themeMode]);

  // Apply CSS vars whenever isDark changes
  useEffect(() => {
    applyVars(isDark ? DARK_VARS : LIGHT_VARS, isDark);
  }, [isDark]);

  useEffect(() => {
    const saved = localStorage.getItem("selectedBackgroundImage");
    setBgimage(saved || defaultImg);
  }, []);

  const isBright = !isDark;

  const handleSetThemeMode = (mode) => {
    if (mode === "light" || mode === "dark" || mode === "system") setThemeModeState(mode);
  };

  // Cycle: system → light → dark → system
  const toggle = () =>
    setThemeModeState((m) => {
      if (m === "system") return isDark ? "light" : "dark";
      if (m === "light") return "dark";
      return "system";
    });

  const handleSetBgImage = (src) => {
    setBgimage(src);
    localStorage.setItem("selectedBackgroundImage", src);
  };

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        setThemeMode: handleSetThemeMode,
        toggle,
        isBright,
        bgimage,
        setBgimage,
        handleSetBgImage,
        videoOn,
        setVideoOn,
        videoRef,
        bgimageRef,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
}
