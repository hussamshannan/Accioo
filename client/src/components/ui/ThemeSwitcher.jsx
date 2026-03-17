import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Monitor } from "lucide-react";

const ICONS = {
  light:  <Sun     className="w-4 h-4" />,
  dark:   <Moon    className="w-4 h-4" />,
  system: <Monitor className="w-4 h-4" />,
};

const TITLES = {
  light:  "Light mode (click for dark)",
  dark:   "Dark mode (click for system)",
  system: "System theme (click to override)",
};

export default function ThemeSwitcher() {
  const { themeMode, toggle } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      title={TITLES[themeMode] ?? "Toggle theme"}
      className="text-muted-foreground"
    >
      {ICONS[themeMode] ?? <Monitor className="w-4 h-4" />}
    </Button>
  );
}
