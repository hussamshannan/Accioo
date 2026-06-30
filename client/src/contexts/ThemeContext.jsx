import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import defaultImg from "../assets/images/frank-huang-WxQdHLGT7s8-unsplash.jpg";
import {
  THEMES,
  THEME_LIST,
  DEFAULT_THEME_ID,
  isValidThemeId,
  resolveThemeVars,
} from "../utils/themes";
import { useAuth } from "./AuthContext";
import { updateTheme as updateThemeApi } from "../services/userService";

const ThemeContext = createContext(null);

const MODES = ["system", "light", "dark"];

function applyVars(vars, dark) {
  const el = document.documentElement;
  Object.entries(vars).forEach(([k, v]) => el.style.setProperty(k, v));
  el.classList.toggle("dark", dark);
}

const getDeviceDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

export function ThemeProvider({ children }) {
  const { isSignedIn, dbUser, setDbUser } = useAuth();

  // Named theme (palette). Persisted per-user; localStorage cache avoids a flash
  // on boot before dbUser loads.
  const [themeName, setThemeNameState] = useState(() => {
    const saved = localStorage.getItem("themeName");
    return saved && isValidThemeId(saved) ? saved : DEFAULT_THEME_ID;
  });

  // "system" | "light" | "dark"
  const [themeMode, setThemeModeState] = useState(() => {
    const saved = localStorage.getItem("themeMode");
    return MODES.includes(saved) ? saved : "system";
  });

  // The resolved dark/light value used to apply vars
  const [isDark, setIsDark] = useState(() => getDeviceDark());

  const [bgimage, setBgimage] = useState(null);
  const [videoOn, setVideoOn] = useState(false);
  const videoRef = useRef(null);
  const bgimageRef = useRef(null);

  // Push the user's theme preference to the server (no-op when signed out).
  const persistTheme = useCallback(
    (patch) => {
      if (!isSignedIn) return;
      updateThemeApi(patch)
        .then((res) => {
          if (res?.data?.user) setDbUser?.(res.data.user);
        })
        .catch((err) => console.error("Failed to save theme:", err));
    },
    [isSignedIn, setDbUser]
  );

  // Hydrate from the signed-in user's saved preference. Uses the raw state
  // setters so this does NOT echo back to the server.
  useEffect(() => {
    if (!dbUser) return;
    if (dbUser.themeName && isValidThemeId(dbUser.themeName)) {
      setThemeNameState(dbUser.themeName);
      localStorage.setItem("themeName", dbUser.themeName);
    }
    if (MODES.includes(dbUser.themeMode)) {
      setThemeModeState(dbUser.themeMode);
      localStorage.setItem("themeMode", dbUser.themeMode);
    }
  }, [dbUser]);

  // Recalculate isDark when the mode changes
  useEffect(() => {
    if (themeMode === "system") setIsDark(getDeviceDark());
    else setIsDark(themeMode === "dark");
  }, [themeMode]);

  // Follow OS theme changes while in "system" mode
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => {
      if (themeMode === "system") setIsDark(e.matches);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [themeMode]);

  // Apply CSS vars whenever the resolved theme or mode changes
  useEffect(() => {
    applyVars(resolveThemeVars(themeName, isDark), isDark);
  }, [isDark, themeName]);

  useEffect(() => {
    const saved = localStorage.getItem("selectedBackgroundImage");
    setBgimage(saved || defaultImg);
  }, []);

  const isBright = !isDark;

  // Public: change the named theme (applies app-wide + persists)
  const setThemeName = (id) => {
    if (!isValidThemeId(id) || id === themeName) return;
    setThemeNameState(id);
    localStorage.setItem("themeName", id);
    persistTheme({ themeName: id });
  };

  // Public: change light/dark/system mode (persists)
  const setThemeMode = (mode) => {
    if (!MODES.includes(mode) || mode === themeMode) return;
    setThemeModeState(mode);
    localStorage.setItem("themeMode", mode);
    persistTheme({ themeMode: mode });
  };

  // Cycle: system → light → dark → system
  const toggle = () => {
    const next =
      themeMode === "system" ? (isDark ? "light" : "dark") : themeMode === "light" ? "dark" : "system";
    setThemeMode(next);
  };

  const handleSetBgImage = (src) => {
    setBgimage(src);
    localStorage.setItem("selectedBackgroundImage", src);
  };

  return (
    <ThemeContext.Provider
      value={{
        // named theme
        themeName,
        setThemeName,
        themes: THEME_LIST,
        THEMES,
        // mode
        themeMode,
        setThemeMode,
        toggle,
        isBright,
        isDark,
        // chat background (unchanged)
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
