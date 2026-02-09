"use client";

import { ArrowRight, Film, Sparkles, UploadCloud, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  ApiClientError,
  createProject,
  getMe,
} from "~/lib/assets-api";
import { setPendingUpload } from "~/lib/pending-upload";
import { cn } from "~/lib/utils";
import { saveUpload } from "~/lib/upload-session";

const FILE_HINTS = [
  "MP4, MOV, WebM",
  "16:9 or 9:16",
  "Audio + video",
];

const EXPERIENCE_STEPS = [
  {
    title: "Describe intent",
    copy: "Tell the agent how the edit should feel: cinematic, airy, punchy.",
  },
  {
    title: "Auto cut plan",
    copy: "We draft the full edit with pacing, grades, and transitions.",
  },
  {
    title: "Iterate fast",
    copy: "Adjust beats in chat and preview only the changed segments.",
  },
];

function isVideoFile(file: File) {
  return file.type.startsWith("video/") || /\.(mp4|mov|webm)$/i.test(file.name);
}

function deriveProjectTitle(fileName: string) {
  const raw = fileName.replace(/\.[^/.]+$/, "").trim();
  return raw || "Untitled Project";
}

export function HomePage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const featureBadges = useMemo(() => FILE_HINTS, []);

  const handleUpload = useCallback(
    async (file?: File | null) => {
      if (!file) return;
      if (!isVideoFile(file)) {
        setError("Please upload a valid video file.");
        return;
      }

      setError(null);
      setIsStarting(true);

      try {
        await getMe();
        const project = await createProject({
          title: deriveProjectTitle(file.name),
        });

        const projectId = project.project.id;
        const url = URL.createObjectURL(file);
        saveUpload(projectId, {
          url,
          name: file.name,
          size: file.size,
          type: file.type || "video/mp4",
          status: "local",
        });
        setPendingUpload(projectId, file);

        router.push(`/projects/${projectId}`);
      } catch (caughtError) {
        if (
          caughtError instanceof ApiClientError &&
          caughtError.status === 401
        ) {
          setError("Authentication required. Sign in before uploading.");
        } else {
          setError("Could not initialize upload. Please try again.");
        }
      } finally {
        setIsStarting(false);
      }
    },
    [router],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      const file = event.dataTransfer.files?.[0];
      void handleUpload(file);
    },
    [handleUpload],
  );

  const handleSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      void handleUpload(file);
      event.target.value = "";
    },
    [handleUpload],
  );

  return (
    <div className="ds-light min-h-screen">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-44 -top-44 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,221,189,0.7),rgba(255,221,189,0))] blur-3xl" />
        <div className="absolute -right-36 top-24 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(190,215,255,0.6),rgba(190,215,255,0))] blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,201,164,0.55),rgba(255,201,164,0))] blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--ds-border)] bg-[color:var(--ds-glass)] shadow-[var(--ds-shadow-soft)]">
              <Film className="h-5 w-5 text-[color:var(--ds-accent-warm)]" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-[color:var(--ds-muted)]">
                Doujin Studio
              </p>
              <h1 className="display-font text-2xl font-semibold text-[color:var(--ds-text)]">
                AI Video Editor
              </h1>
            </div>
          </div>
          <Button variant="glass" className="rounded-full px-5">
            View demo
            <ArrowRight className="h-4 w-4" />
          </Button>
        </header>

        <main className="page-enter mt-12 grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <section className="space-y-6">
            <div className="inline-flex items-center gap-3 rounded-full border border-[color:var(--ds-border)] bg-[color:var(--ds-glass)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-[color:var(--ds-muted)] shadow-[var(--ds-shadow-soft)]">
              <Sparkles className="h-4 w-4 text-[color:var(--ds-accent-warm)]" />
              Multimodal cinematic edits
            </div>

            <div className="space-y-3">
              <h2 className="display-font text-4xl font-semibold leading-tight text-[color:var(--ds-text)] sm:text-5xl">
                Upload a clip. Direct the edit. Ship a cinematic cut.
              </h2>
              <p className="max-w-xl text-base text-[color:var(--ds-muted)] sm:text-lg">
                Drop any video and talk to the editor like a collaborator. We
                detect story beats, build a full edit decision list, and
                iterate without re-rendering the whole timeline.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {EXPERIENCE_STEPS.map((step) => (
                <div key={step.title} className="glassPanel p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[color:var(--ds-muted)]">
                    {step.title}
                  </p>
                  <p className="mt-3 text-sm text-[color:var(--ds-text)]">
                    {step.copy}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <Card className="bg-[color:var(--ds-glass)]">
            <CardHeader className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.35em] text-[color:var(--ds-muted)]">
                <Wand2 className="h-4 w-4 text-[color:var(--ds-accent-warm)]" />
                Start editing
              </div>
              <CardTitle className="text-2xl text-[color:var(--ds-text)]">
                Upload your video
              </CardTitle>
              <CardDescription>
                A single file is enough to spin up the cinematic editor.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div
                className={cn(
                  "group relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-4 rounded-[28px] border border-dashed border-[color:var(--ds-border)] bg-white/55 p-6 text-center shadow-[var(--ds-shadow-soft)] transition",
                  isDragging &&
                    "border-[color:var(--ds-accent-warm)] bg-white/80",
                )}
                onClick={() => inputRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
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
                  {featureBadges.map((hint) => (
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
                onChange={handleSelect}
                className="hidden"
              />

              {error ? (
                <p className="text-sm text-red-500">{error}</p>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-[color:var(--ds-muted)]">
                  Starts local for instant preview, then uploads securely.
                </p>
                <Button
                  variant="accent"
                  className="rounded-full px-6"
                  disabled={isStarting}
                  onClick={() => inputRef.current?.click()}
                >
                  {isStarting ? "Preparing..." : "Choose file"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
