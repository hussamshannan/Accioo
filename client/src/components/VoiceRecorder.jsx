import { Mic, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

/* Decorative equalizer shown while recording. Purely an affordance that a
 * recording is in progress — not a render of the captured waveform. */
function Equalizer() {
  return (
    <div className="flex flex-1 items-center justify-end gap-[3px] overflow-hidden h-5">
      {Array.from({ length: 28 }).map((_, i) => (
        <span
          key={i}
          className="eq-bar bg-muted-foreground"
          style={{ height: `${8 + (i % 5) * 3}px`, animationDelay: `${(i % 7) * 0.08}s` }}
        />
      ))}
    </div>
  );
}

/**
 * Tap-to-toggle voice recorder control (shadcn/ui).
 *
 * Idle: a single ghost mic button. Tapping it starts recording — a discrete
 * event, so awaiting getUserMedia no longer races a button release.
 *
 * Recording: takes over the composer row — live timer, equalizer, plus trash
 * (cancel) and send (stop + upload) buttons, all uniform shadcn controls.
 */
function VoiceRecorder({
  isRecording,
  recordingDuration,
  onStart,
  onStop,
  onCancel,
  disabled = false,
  formatDuration,
}) {
  if (isRecording) {
    return (
      <div className="flex flex-1 items-center gap-2 min-w-0">
        <span className="h-2.5 w-2.5 rounded-full bg-destructive animate-pulse shrink-0" />
        <span className="text-sm tabular-nums text-foreground shrink-0">
          {formatDuration(recordingDuration)}
        </span>
        <Equalizer />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onCancel}
          aria-label="Cancel recording"
          className="shrink-0 rounded-full text-destructive"
        >
          <Trash2 className="h-5 w-5" />
        </Button>
        <Button
          type="button"
          variant="default"
          size="icon"
          onClick={onStop}
          aria-label="Send voice message"
          className="shrink-0"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onStart}
            disabled={disabled}
            aria-label="Record voice message"
            className="shrink-0 rounded-full text-muted-foreground"
          >
            <Mic className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Record voice message</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default VoiceRecorder;
