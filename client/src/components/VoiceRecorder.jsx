import { forwardRef } from "react";
import { Mic, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

/**
 * Tap-to-toggle voice recorder control (shadcn/ui).
 *
 * Idle: a single ghost mic button. Tapping it starts recording — a discrete
 * event, so awaiting getUserMedia no longer races a button release (the old
 * press-and-hold bug where a quick tap captured nothing).
 *
 * Recording: trash (cancel), live timer, and send (stop + upload) buttons.
 *
 * Renders a single root <div> in every state and forwards the ref to it so the
 * parent's GSAP show/hide timeline keeps a stable DOM node to animate.
 */
const VoiceRecorder = forwardRef(function VoiceRecorder(
  {
    isRecording,
    recordingDuration,
    onStart,
    onStop,
    onCancel,
    disabled = false,
    formatDuration,
  },
  ref,
) {
  return (
    <div ref={ref} className="flex items-center gap-1.5 flex-shrink-0">
      {isRecording ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onCancel}
            aria-label="Cancel recording"
            className="text-destructive"
          >
            <Trash2 className="h-5 w-5" />
          </Button>
          <span className="flex items-center gap-1.5 text-sm tabular-nums text-destructive whitespace-nowrap">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
            {formatDuration(recordingDuration)}
          </span>
          <Button
            type="button"
            variant="default"
            size="icon"
            onClick={onStop}
            aria-label="Send voice message"
          >
            <Send className="h-5 w-5" />
          </Button>
        </>
      ) : (
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
              >
                <Mic className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Record voice message</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
});

export default VoiceRecorder;
