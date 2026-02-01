"use client";

import {
  ArrowUp,
  CirclePlus,
  Clipboard,
  Cloud,
  FileUp,
  History,
  ImagePlus,
  LayoutDashboard,
  LayoutTemplate,
  Link as LinkIcon,
  Paperclip,
  Play,
  Plus,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";

interface AttachedFile {
  id: string;
  name: string;
  file: File;
  preview?: string;
}

const ACTIONS = [
  { id: "add-url", icon: LinkIcon, label: "Add URL" },
  { id: "upload-media", icon: FileUp, label: "Upload Media" },
  { id: "use-template", icon: LayoutTemplate, label: "Use Template" },
  { id: "view-examples", icon: LayoutDashboard, label: "View Examples" },
];

const MODELS = [
  {
    value: "gpt-5",
    name: "GPT-5",
    description: "Most advanced model",
    max: true,
  },
  {
    value: "gpt-4o",
    name: "GPT-4o",
    description: "Fast and capable",
  },
  {
    value: "gpt-4",
    name: "GPT-4",
    description: "Reliable and accurate",
  },
  {
    value: "claude-3.5",
    name: "Claude 3.5 Sonnet",
    description: "Great for coding tasks",
  },
];

interface AiChatInputProps {
  onSubmit?: (message: string) => void;
  disabled?: boolean;
  variant?: "main" | "compact";
}

const QUICK_FILL_PROMPT =
  "https://lumina-bikes.com | 30s launch edit | emphasize carbon frame, dual motor assist, and overnight shipping. Mood: cinematic night ride with neon reflections. CTA: Preorder for March deliveries.";

export function AiChatInput({
  onSubmit,
  disabled,
  variant = "compact",
}: AiChatInputProps) {
  const [prompt, setPrompt] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const fileInputRef = useRef<HTMLTextAreaElement>(null);
  const fileUploadRef = useRef<HTMLInputElement>(null);

  const [settings, setSettings] = useState({
    autoComplete: true,
    streaming: true,
    showHistory: false,
  });

  const generateFileId = () => Math.random().toString(36).substring(7);
  const processFiles = (files: File[]) => {
    for (const file of files) {
      const fileId = generateFileId();
      const attachedFile: AttachedFile = {
        id: fileId,
        name: file.name,
        file,
      };

      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = () => {
          setAttachedFiles((prev) =>
            prev.map((f) =>
              f.id === fileId ? { ...f, preview: reader.result as string } : f,
            ),
          );
        };
        reader.readAsDataURL(file);
      }

      setAttachedFiles((prev) => [...prev, attachedFile]);
    }
  };

  const submitPrompt = () => {
    if (prompt.trim() && onSubmit) {
      onSubmit(prompt.trim());
      setPrompt("");
      if (fileInputRef.current) {
        fileInputRef.current.style.height = "auto";
      }
    }
  };

  const updateSetting = (key: keyof typeof settings, value: boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submitPrompt();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFiles(files);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitPrompt();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    processFiles(files);

    if (fileUploadRef.current) {
      fileUploadRef.current.value = "";
    }
  };

  const handleRemoveFile = (fileId: string) => {
    setAttachedFiles((prev) => prev.filter((file) => file.id !== fileId));
  };

  const handleModelChange = (value: string) => {
    const model = MODELS.find((m) => m.value === value);
    if (model) {
      setSelectedModel(model);
    }
  };

  const renderMaxBadge = () => (
    <div className="flex h-[14px] items-center gap-1.5 rounded border border-border px-1 py-0">
      <span className="text-[9px] font-bold uppercase text-sky-200">MAX</span>
    </div>
  );

  if (variant === "main") {
    const handleQuickFill = () => {
      if (!disabled) {
        setPrompt(QUICK_FILL_PROMPT);
      }
    };

    return (
      <div className="relative mx-auto flex w-full max-w-3xl flex-col gap-5">
        <div className="relative z-10">
          <form
            className="relative overflow-hidden rounded-[32px] border border-white/15 bg-[rgba(6,11,29,0.75)] p-6 shadow-[0_30px_85px_rgba(3,6,18,0.7)] backdrop-blur-2xl"
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onSubmit={handleSubmit}
          >
            <div className="mb-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.35em] text-white/60">
              <Sparkles className="h-4 w-4 text-emerald-300" />
              Compose your brief
            </div>

            {attachedFiles.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {attachedFiles.map((file) => (
                  <Badge
                    key={file.id}
                    className="group flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[13px] text-white"
                    variant="outline"
                  >
                    <div className="relative inline-flex h-5 w-5 items-center justify-center">
                      {file.preview ? (
                        <Image
                          alt={file.name}
                          className="absolute inset-0 h-5 w-5 rounded-full border border-white/20 object-cover"
                          height={20}
                          src={file.preview}
                          width={20}
                        />
                      ) : (
                        <Paperclip className="h-4 w-4 opacity-70" />
                      )}
                    </div>
                    <span className="max-w-[160px] truncate">{file.name}</span>
                    <button
                      className="rounded-full bg-white/10 p-0.5 text-white/70 opacity-0 transition group-hover:opacity-100"
                      onClick={() => handleRemoveFile(file.id)}
                      type="button"
                    >
                      <X size={12} />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <Textarea
              className="max-h-60 min-h-[150px] resize-none border-none bg-transparent p-0 text-base text-white placeholder:text-white/50 shadow-none focus-visible:ring-0"
              disabled={disabled}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Enter a URL, mood, hook, or any guardrails for this ad"
              value={prompt}
            />

            <div className="mt-5 flex flex-col gap-4 border-t border-white/10 pt-4 md:flex-row md:items-center">
              <div className="flex flex-1 items-center gap-1.5">
                <input
                  className="sr-only"
                  multiple
                  onChange={handleFileSelect}
                  ref={fileUploadRef}
                  type="file"
                />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      className="h-9 w-9 rounded-2xl border border-white/10 bg-white/5 text-white hover:bg-white/15"
                      disabled={disabled}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <Plus size={16} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="max-w-xs rounded-2xl border border-white/10 bg-[#060b1d] p-2 text-white"
                  >
                    <DropdownMenuGroup className="space-y-1">
                      <DropdownMenuItem
                        className="rounded-xl text-sm"
                        onClick={() => fileUploadRef.current?.click()}
                      >
                        <div className="flex items-center gap-2">
                          <Paperclip className="text-white/70" size={16} />
                          <span>Attach files</span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="rounded-xl text-sm">
                        <div className="flex items-center gap-2">
                          <LinkIcon className="text-white/70" size={16} />
                          <span>Import from URL</span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="rounded-xl text-sm">
                        <div className="flex items-center gap-2">
                          <Clipboard className="text-white/70" size={16} />
                          <span>Paste from clipboard</span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="rounded-xl text-sm">
                        <div className="flex items-center gap-2">
                          <LayoutTemplate className="text-white/70" size={16} />
                          <span>Use template</span>
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      className="h-9 w-9 rounded-2xl border border-white/10 bg-white/5 text-white hover:bg-white/15"
                      disabled={disabled}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <Settings2 size={16} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="w-52 rounded-2xl border border-white/10 bg-[#060b1d] p-3 text-white"
                  >
                    <DropdownMenuGroup className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="text-white/60" size={16} />
                          <Label className="text-xs text-white/80">
                            Auto-complete
                          </Label>
                        </div>
                        <Switch
                          checked={settings.autoComplete}
                          className="scale-75"
                          onCheckedChange={(value) =>
                            updateSetting("autoComplete", value)
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Play className="text-white/60" size={16} />
                          <Label className="text-xs text-white/80">
                            Streaming
                          </Label>
                        </div>
                        <Switch
                          checked={settings.streaming}
                          className="scale-75"
                          onCheckedChange={(value) =>
                            updateSetting("streaming", value)
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <History className="text-white/60" size={16} />
                          <Label className="text-xs text-white/80">
                            Show history
                          </Label>
                        </div>
                        <Switch
                          checked={settings.showHistory}
                          className="scale-75"
                          onCheckedChange={(value) =>
                            updateSetting("showHistory", value)
                          }
                        />
                      </div>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

                <p className="hidden text-xs text-white/50 md:block">
                  Attach inspiration or compliance notes.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button
                  className="rounded-full border border-white/20 bg-transparent px-4 py-2 text-white/70 hover:border-white/40"
                  disabled={disabled}
                  onClick={handleQuickFill}
                  type="button"
                  variant="ghost"
                >
                  Quick fill brand kit
                </Button>
                <Button
                  className="rounded-full bg-sky-500 px-5 py-2 font-semibold text-white transition hover:bg-sky-400 disabled:opacity-60"
                  disabled={!prompt.trim() || disabled}
                  size="sm"
                  type="submit"
                >
                  Generate storyboard
                  <ArrowUp size={16} />
                </Button>
              </div>
            </div>

            <div
              className={cn(
                "pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-[inherit] border border-dashed border-white/30 bg-white/5 text-sm font-medium text-white transition-opacity",
                isDragOver ? "opacity-100" : "opacity-0",
              )}
            >
              <span className="flex items-center gap-2">
                <CirclePlus className="h-4 w-4" /> Drop files to include
                references
              </span>
            </div>
          </form>
        </div>

        <div className="relative z-10 flex flex-wrap items-center justify-center gap-2">
          {ACTIONS.map((action) => (
            <Button
              key={action.id}
              className="gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-xs uppercase tracking-[0.3em] text-white/70 hover:bg-white/15"
              disabled={disabled}
              size="sm"
              variant="ghost"
            >
              <action.icon className="h-4 w-4" />
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[120px] flex-col rounded-2xl cursor-text bg-card border border-border shadow-lg">
      <div className="flex-1 relative overflow-y-auto max-h-[258px]">
        <Textarea
          ref={fileInputRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submitPrompt();
            }
          }}
          placeholder="Ask anything"
          disabled={disabled}
          className="w-full border-0 p-3 transition-[padding] duration-200 ease-in-out min-h-[48.4px] outline-none text-[16px] text-foreground resize-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent! whitespace-pre-wrap break-words"
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = "auto";
            target.style.height = target.scrollHeight + "px";
          }}
        />
      </div>

      <div className="flex min-h-[40px] items-center gap-2 p-2 pb-1">
        <div className="flex aspect-1 items-center gap-1 rounded-full bg-muted p-1.5 text-xs">
          <Cloud className="h-4 w-4 text-muted-foreground" />
        </div>

        <div className="relative flex items-center">
          <Select value={selectedModel.value} onValueChange={handleModelChange}>
            <SelectTrigger className="w-fit border-none bg-transparent! p-0 text-sm text-muted-foreground hover:text-foreground focus:ring-0 shadow-none">
              <SelectValue>
                {selectedModel.max ? (
                  <div className="flex items-center gap-1">
                    <span>{selectedModel.name}</span>
                    {renderMaxBadge()}
                  </div>
                ) : (
                  <span>{selectedModel.name}</span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {MODELS.map((model) => (
                <SelectItem key={model.value} value={model.value}>
                  {model.max ? (
                    <div className="flex items-center gap-1">
                      <span>{model.name}</span>
                      {renderMaxBadge()}
                    </div>
                  ) : (
                    <span>{model.name}</span>
                  )}
                  <span className="text-muted-foreground block text-xs">
                    {model.description}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground transition-all duration-100"
            title="Attach images"
          >
            <ImagePlus className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={submitPrompt}
            className={cn(
              "h-6 w-6 rounded-full transition-all duration-100 cursor-pointer bg-primary",
              prompt && "bg-primary hover:bg-primary/90!",
            )}
            disabled={!prompt || disabled}
          >
            <ArrowUp className="h-4 w-4 text-primary-foreground" />
          </Button>
        </div>
      </div>
    </div>
  );
}
