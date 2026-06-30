import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import ThemePicker from "@/components/ui/ThemePicker";

export default function ThemesPage() {
  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="-ml-1 text-muted-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <span className="flex-1 text-base font-bold text-foreground">Appearance</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-4 py-5">
          <p className="mb-4 text-sm text-muted-foreground">
            Pick a theme and light/dark mode. Your choice is saved to your account.
          </p>
          <ThemePicker />
        </div>
      </ScrollArea>
    </div>
  );
}
