import { createElement } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { resolveThemeVars } from "@/utils/themes";
import { Check, Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

const MODE_OPTIONS = [
  { mode: "light", icon: Sun, label: "Light" },
  { mode: "dark", icon: Moon, label: "Dark" },
  { mode: "system", icon: Monitor, label: "System" },
];

/* A self-contained mini mock of the app chrome, rendered with one theme's CSS
   vars applied to its own wrapper (does NOT touch <html>) so each card previews
   exactly how that theme looks in the currently-resolved light/dark mode. */
function ThemePreview({ themeId, dark }) {
  const vars = resolveThemeVars(themeId, dark);
  return (
    <div
      style={vars}
      className="pointer-events-none flex flex-col gap-1.5 rounded-lg p-2.5 overflow-hidden"
    >
      <div style={{ background: "var(--background)" }} className="rounded-md p-2 flex flex-col gap-1.5">
        {/* header row */}
        <div className="flex items-center gap-1.5">
          <span style={{ background: "var(--muted)" }} className="h-4 w-4 rounded-full" />
          <span style={{ background: "var(--foreground)", opacity: 0.85 }} className="h-1.5 w-10 rounded-full" />
        </div>
        {/* received bubble */}
        <span
          style={{ background: "var(--bubble-received)", color: "var(--bubble-received-fg)" }}
          className="self-start rounded-md px-2 py-1 text-[8px] leading-none"
        >
          Hi there
        </span>
        {/* sent bubble */}
        <span
          style={{ background: "var(--bubble-sent)", color: "var(--bubble-sent-fg)" }}
          className="self-end rounded-md px-2 py-1 text-[8px] leading-none"
        >
          Hey! 👋
        </span>
        {/* primary action */}
        <span
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
          className="mt-0.5 self-stretch rounded-full py-1 text-center text-[8px] font-semibold leading-none"
        >
          Send
        </span>
      </div>
    </div>
  );
}

export default function ThemePicker() {
  const { themes, themeName, setThemeName, themeMode, setThemeMode, isDark } = useTheme();

  return (
    <div className="flex flex-col gap-4">
      {/* Light / Dark / System */}
      <div className="flex gap-2">
        {MODE_OPTIONS.map((opt) => (
          <button
            key={opt.mode}
            type="button"
            onClick={() => setThemeMode(opt.mode)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-full border py-2 text-xs font-medium transition-colors",
              themeMode === opt.mode
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground"
            )}
          >
            {createElement(opt.icon, { className: "h-3.5 w-3.5" })}
            {opt.label}
          </button>
        ))}
      </div>

      {/* Theme palettes with live preview */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {themes.map((theme) => {
          const selected = theme.id === themeName;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => setThemeName(theme.id)}
              aria-pressed={selected}
              className={cn(
                "group relative flex flex-col overflow-hidden rounded-xl border-2 text-left transition-colors",
                selected ? "border-primary" : "border-border hover:border-muted-foreground/40"
              )}
            >
              <ThemePreview themeId={theme.id} dark={isDark} />
              <div className="flex items-center justify-between gap-1 border-t border-border bg-card px-2.5 py-1.5">
                <span className="truncate text-xs font-medium text-foreground">
                  {theme.label}
                </span>
                {selected && (
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
