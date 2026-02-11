import { Sparkles } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";

type PlaybackPanelProps = {
  commandInput: string;
  isInterpreting: boolean;
  lastReasoning: string | null;
  onCommandInputChange: (value: string) => void;
  onSendCommand: () => void;
};

export const PlaybackPanel = ({
  commandInput,
  isInterpreting,
  lastReasoning,
  onCommandInputChange,
  onSendCommand,
}: PlaybackPanelProps) => {
  return (
    <Card className="editor-panel-strong text-white">
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/50">
          <Sparkles className="h-4 w-4 text-[color:var(--editor-accent)]" />
          Playback Control
        </div>
        <CardTitle className="text-xl text-white">
          AI playback assistant
        </CardTitle>
        <CardDescription className="text-white/60">
          Type commands to control preview playback (seek, pause, restart).
        </CardDescription>
      </CardHeader>
      <Separator className="bg-white/10" />
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <Input
            className="bg-white/10 text-white placeholder:text-white/40"
            placeholder="Type a command (e.g., 'go to middle', 'restart', 'pause')"
            value={commandInput}
            disabled={isInterpreting}
            onChange={(e) => onCommandInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSendCommand();
            }}
          />
          <Button
            variant="accent"
            onClick={onSendCommand}
            disabled={isInterpreting || !commandInput.trim()}
          >
            {isInterpreting ? "..." : "Send"}
          </Button>
        </div>

        {lastReasoning && (
          <p className="text-xs italic text-white/40">AI: {lastReasoning}</p>
        )}
      </CardContent>
    </Card>
  );
};
