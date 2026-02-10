"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { ArrowRight, UploadCloud, Wand2 } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import { useCreateProjectFromFile } from "../hooks/useCreateProjectFromFile";

const FILE_HINTS = ["MP4, MOV, WebM", "16:9 or 9:16", "Audio + video"] as const;

export function UploadToCreateProjectModal(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const hints = useMemo(() => FILE_HINTS, []);

  const { isStarting, error, resumeMessage, startFromFile } =
    useCreateProjectFromFile({ nextPathAfterAuth: "/projects" });

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      const file = event.dataTransfer.files?.[0];
      void startFromFile(file);
    },
    [startFromFile],
  );

  const onSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      void startFromFile(file);
      event.target.value = "";
    },
    [startFromFile],
  );

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent size="lg" className="p-0">
        <DialogHeader>
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.35em] text-[color:var(--ds-muted)]">
            <Wand2 className="h-4 w-4 text-[color:var(--ds-accent-warm)]" />
            New project
          </div>
          <DialogTitle>Upload a clip to create a project</DialogTitle>
          <DialogDescription>
            Projects start with footage. Pick a video file and we’ll drop you
            straight into the editor.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-2">
          <div
            className={cn(
              "group relative flex min-h-[240px] cursor-pointer flex-col items-center justify-center gap-4 rounded-[28px] border border-dashed border-[color:var(--ds-border)] bg-white/55 p-6 text-center shadow-[var(--ds-shadow-soft)] transition",
              isDragging &&
                "border-[color:var(--ds-accent-warm)] bg-white/80 shadow-[0_18px_52px_rgba(245,141,57,0.18)]",
              isStarting && "cursor-not-allowed opacity-80",
            )}
            onClick={() => {
              if (isStarting) return;
              inputRef.current?.click();
            }}
            onDragOver={(event) => {
              event.preventDefault();
              if (!isStarting) setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[color:var(--ds-border)] bg-white shadow-[var(--ds-shadow-soft)]">
              <UploadCloud className="h-6 w-6 text-[color:var(--ds-accent-warm)]" />
            </div>
            <div>
              <p className="text-base font-semibold text-[color:var(--ds-text)]">
                Drag & drop your clip
              </p>
              <p className="mt-2 text-sm text-[color:var(--ds-muted)]">
                or click to browse your device
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {hints.map((hint) => (
                <Badge key={hint} variant="default" className="normal-case">
                  {hint}
                </Badge>
              ))}
            </div>
          </div>

          <Input
            ref={inputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={onSelect}
          />

          {error ? <p className="mt-4 text-sm text-red-500">{error}</p> : null}
          {resumeMessage ? (
            <p className="mt-4 text-sm text-[color:var(--ds-muted)]">
              {resumeMessage}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="glass"
            className="rounded-full px-5"
            type="button"
            onClick={() => props.onOpenChange(false)}
            disabled={isStarting}
          >
            Cancel
          </Button>
          <Button
            variant="accent"
            className="rounded-full px-6"
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isStarting}
          >
            {isStarting ? "Preparing..." : "Choose file"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
