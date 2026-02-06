"use client";

import {
  ArrowLeft,
  AudioLines,
  Camera,
  Clapperboard,
  Layers,
  Mic,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Save,
  Scissors,
  Sparkles,
  Type,
  Wand2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Separator } from "~/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "~/components/ui/sheet";
import { Textarea } from "~/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import {
  clearUpload,
  loadUpload,
  saveUpload,
  type UploadSession,
} from "~/lib/upload-session";

interface EditorProps {
  projectId?: string;
}

type ToolItem = {
  id: string;
  label: string;
  icon: React.ElementType;
};

type ClipItem = {
  id: string;
  label: string;
  gradient: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  author: string;
  text: string;
  chips?: string[];
};

function deriveTitle(name?: string | null) {
  if (!name) return "Untitled Edit";
  return name.replace(/\.[^/.]+$/, "");
}

function safeProjectId(projectId?: string) {
  if (projectId) return projectId;
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `proj_${Date.now().toString(36)}`;
}

function ChatPanel() {
  const messages = useMemo<ChatMessage[]>(
    () => [
      {
        id: "m1",
        role: "user",
        author: "You",
        text: "Make this cinematic. Slow the pacing, add warm highlights, and tighten the first 12 seconds.",
        chips: ["intent: cinematic", "pacing 80%"],
      },
      {
        id: "m2",
        role: "assistant",
        author: "Studio",
        text: "Drafting edit plan: 6 cuts, 2 speed ramps, warm grade, and a subtle film grain. Previewing the new intro sequence now.",
        chips: ["EDL v3", "preview 0:00-0:14"],
      },
      {
        id: "m3",
        role: "user",
        author: "You",
        text: "The mid section feels too dark. Lift shadows around 0:42.",
        chips: ["feedback", "0:42"],
      },
      {
        id: "m4",
        role: "assistant",
        author: "Studio",
        text: "Boosted mids +12, added localized exposure in the left half of frame. Keeping blacks intact for contrast.",
        chips: ["grade tweak", "shadow +12"],
      },
    ],
    [],
  );

  return (
    <Card className="editor-panel-strong text-white">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/50">
            <Sparkles className="h-4 w-4 text-[color:var(--editor-accent)]" />
            Ask AI
          </div>
          <Badge variant="outline" className="normal-case tracking-[0.1em]">
            Live edit
          </Badge>
        </div>
        <CardTitle className="text-xl text-white">
          Cinematic edit assistant
        </CardTitle>
        <CardDescription className="text-white/60">
          Tell the editor how the story should feel. It handles the cuts,
          transitions, and color decisions.
        </CardDescription>
      </CardHeader>
      <Separator className="bg-white/10" />
      <CardContent className="flex h-[420px] flex-col gap-4">
        <ScrollArea className="h-full pr-3">
          <div className="space-y-4">
            {messages.map((message) => (
              <div key={message.id} className="flex gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback>
                    {message.role === "user" ? "ME" : "AI"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white">
                      {message.author}
                    </p>
                    <Badge variant="subtle" className="normal-case">
                      {message.role === "user" ? "Command" : "Reasoning"}
                    </Badge>
                  </div>
                  <p className="text-sm text-white/80">{message.text}</p>
                  {message.chips ? (
                    <div className="flex flex-wrap gap-2">
                      {message.chips.map((chip) => (
                        <Badge key={chip} variant="outline" className="normal-case">
                          {chip}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="space-y-3">
          <Textarea
            placeholder="Describe the next edit..."
            className="bg-white/10 text-white placeholder:text-white/40"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/50">
              Press enter to send, shift+enter for a new line.
            </p>
            <Button variant="accent" className="rounded-full px-5">
              Send
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function Editor({ projectId }: EditorProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [upload, setUpload] = useState<UploadSession | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState("select");

  const tools = useMemo<ToolItem[]>(
    () => [
      { id: "select", label: "Select", icon: Clapperboard },
      { id: "cut", label: "Cut", icon: Scissors },
      { id: "type", label: "Type", icon: Type },
      { id: "audio", label: "Audio", icon: AudioLines },
      { id: "voice", label: "Voice", icon: Mic },
      { id: "layers", label: "Layers", icon: Layers },
      { id: "camera", label: "Cameras", icon: Camera },
      { id: "magic", label: "AI", icon: Wand2 },
    ],
    [],
  );

  const clips = useMemo<ClipItem[]>(
    () => [
      {
        id: "clip-1",
        label: "Wide",
        gradient: "linear-gradient(135deg, #f5d8b2 0%, #caa47f 100%)",
      },
      {
        id: "clip-2",
        label: "Close",
        gradient: "linear-gradient(135deg, #e0e8f5 0%, #9bb2d3 100%)",
      },
      {
        id: "clip-3",
        label: "Motion",
        gradient: "linear-gradient(135deg, #f1d2d4 0%, #bf7a7f 100%)",
      },
      {
        id: "clip-4",
        label: "Insert",
        gradient: "linear-gradient(135deg, #e6f0d2 0%, #a5b97c 100%)",
      },
      {
        id: "clip-5",
        label: "Portrait",
        gradient: "linear-gradient(135deg, #e1d7ff 0%, #9f8ddb 100%)",
      },
    ],
    [],
  );

  const timeChips = useMemo(
    () => [
      "00s - 10s",
      "15s - 25s",
      "30s - 40s",
      "45s - 55s",
      "1m 00s - 1m 10s",
      "1m 15s - 1m 25s",
      "1m 30s - 1m 40s",
    ],
    [],
  );

  useEffect(() => {
    if (!projectId) return;
    const stored = loadUpload(projectId);
    if (stored) {
      setUpload(stored);
      setVideoError(null);
    }
  }, [projectId]);

  const handleUpload = useCallback(
    (file?: File | null) => {
      if (!file) return;
      const resolvedId = safeProjectId(projectId);
      const url = URL.createObjectURL(file);
      const nextUpload: UploadSession = {
        url,
        name: file.name,
        size: file.size,
        type: file.type || "video/mp4",
        createdAt: Date.now(),
      };
      saveUpload(resolvedId, nextUpload);
      setUpload(nextUpload);
      setVideoError(null);
      if (!projectId) {
        router.push(`/projects/${resolvedId}`);
      }
    },
    [projectId, router],
  );

  const handleVideoError = useCallback(() => {
    if (!projectId) return;
    clearUpload(projectId);
    setUpload(null);
    setVideoError("Video preview expired. Upload again to continue.");
  }, [projectId]);

  const title = deriveTitle(upload?.name);

  return (
    <div className="ds-editor min-h-screen">
      <div className="relative mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-6 py-8">
        <div className="grid w-full gap-6 lg:grid-cols-[72px_minmax(0,1fr)] xl:grid-cols-[72px_minmax(0,1fr)_360px]">
          <aside className="editor-rail hidden flex-col items-center gap-3 lg:flex">
            <TooltipProvider>
              {tools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Tooltip key={tool.id}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "editor-tool",
                          activeTool === tool.id && "editor-tool-active",
                        )}
                        onClick={() => setActiveTool(tool.id)}
                      >
                        <Icon className="h-5 w-5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{tool.label}</TooltipContent>
                  </Tooltip>
                );
              })}
            </TooltipProvider>
          </aside>

          <section className="flex flex-col gap-6">
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
              <Button
                variant="glass"
                size="icon"
                className="rounded-full"
                onClick={() => router.push("/")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>

              <div className="flex justify-center">
                <div className="editor-pill pill-float flex items-center gap-2 text-sm font-semibold">
                  <span>Project: {title}</span>
                  <button
                    type="button"
                    className="rounded-full bg-white/10 p-1 text-white/70 transition hover:text-white"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="glass"
                      size="icon"
                      className="rounded-full"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Project</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>Rename</DropdownMenuItem>
                    <DropdownMenuItem>Duplicate</DropdownMenuItem>
                    <DropdownMenuItem>Export still</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="glass" size="icon" className="rounded-full">
                  <Plus className="h-4 w-4" />
                </Button>
                <Button variant="glass" size="icon" className="rounded-full">
                  <Save className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="editor-stage aspect-[16/9]">
              {upload ? (
                <video
                  className="h-full w-full object-cover"
                  src={upload.url}
                  controls
                  onError={handleVideoError}
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-white/10">
                    <Clapperboard className="h-7 w-7 text-white/70" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-lg font-semibold text-white">
                      Upload a clip to begin
                    </p>
                    <p className="text-sm text-white/60">
                      Your footage stays local for this cinematic demo.
                    </p>
                  </div>
                  <Button
                    variant="accent"
                    className="rounded-full px-6"
                    onClick={() => inputRef.current?.click()}
                  >
                    Choose a video
                  </Button>
                  {videoError ? (
                    <p className="text-sm text-[color:var(--editor-accent)]">
                      {videoError}
                    </p>
                  ) : null}
                </div>
              )}

              {upload ? (
                <div className="absolute left-6 top-6 flex items-center gap-3 rounded-full bg-black/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/70 backdrop-blur">
                  <span>Footage</span>
                  <Button
                    variant="glass"
                    size="sm"
                    className="rounded-full px-4"
                    onClick={() => inputRef.current?.click()}
                  >
                    Replace
                  </Button>
                </div>
              ) : null}

              {upload ? (
                <div className="absolute right-6 bottom-6 flex items-center gap-2 rounded-full bg-[color:var(--editor-accent)] px-4 py-3 text-[#1a1a14] shadow-[0_20px_45px_rgba(216,221,90,0.45)]">
                  <button
                    type="button"
                    className="rounded-full bg-black/10 p-2"
                  >
                    <Sparkles className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-black/10 p-2"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-black/10 p-2"
                  >
                    <AudioLines className="h-4 w-4" />
                  </button>
                </div>
              ) : null}

              <Input
                ref={inputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(event) => {
                  handleUpload(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </div>

            <div className="timelineDock px-6 py-5">
              <div className="flex items-center gap-4">
                <Button
                  variant="glass"
                  size="icon"
                  className="rounded-full"
                  onClick={() => inputRef.current?.click()}
                >
                  <Plus className="h-4 w-4" />
                </Button>

                <div className="relative flex-1 overflow-hidden">
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {clips.map((clip) => (
                      <div
                        key={clip.id}
                        className="timeline-clip"
                        style={{ backgroundImage: clip.gradient }}
                      >
                        <span className="absolute bottom-2 left-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">
                          {clip.label}
                        </span>
                      </div>
                    ))}
                    <div className="timeline-clip flex items-center justify-center text-white/70">
                      <Plus className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="timeline-playhead absolute left-1/2 top-0 h-full" />
                </div>

                <Button
                  variant="glass"
                  size="icon"
                  className="rounded-full"
                >
                  <Play className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {timeChips.map((chip, index) => (
                <button
                  key={chip}
                  type="button"
                  className={cn(
                    "time-chip",
                    index === 4 && "time-chip-active",
                  )}
                >
                  {chip}
                </button>
              ))}
            </div>
          </section>

          <aside className="hidden xl:block">
            <ChatPanel />
          </aside>
        </div>

        <div className="xl:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="accent"
                className="fixed bottom-6 right-6 z-40 rounded-full px-5 shadow-[0_25px_60px_rgba(216,221,90,0.45)]"
              >
                Ask AI
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="p-0">
              <div className="p-6">
                <ChatPanel />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </div>
  );
}
