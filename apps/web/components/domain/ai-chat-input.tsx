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
              f.id === fileId ? { ...f, preview: reader.result as string } : f
            )
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
      <span
        className="text-[9px] font-bold uppercase"
        style={{
          background:
            "linear-gradient(to right, rgb(129, 161, 193), rgb(125, 124, 155))",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        MAX
      </span>
    </div>
  );

  if (variant === "main") {
    return (
      <div className="mx-auto flex w-full flex-col gap-4">
        <h1 className="text-pretty text-center font-heading font-semibold text-[29px] text-foreground tracking-tighter sm:text-[32px] md:text-[46px]">
          Create AI-Powered Ads
        </h1>
        <h2 className="-my-5 pb-4 text-center text-xl text-muted-foreground">
          Generate professional video ads from any URL
        </h2>

        <div className="relative z-10 flex flex-col w-full mx-auto max-w-2xl content-center">
          <form
            className="overflow-visible rounded-xl border p-2 transition-colors duration-200 focus-within:border-ring"
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onSubmit={handleSubmit}
          >
            {attachedFiles.length > 0 && (
              <div className="relative flex w-fit items-center gap-2 mb-2 overflow-hidden">
                {attachedFiles.map((file) => (
                  <Badge
                    variant="outline"
                    className="group relative h-6 max-w-30 cursor-pointer overflow-hidden text-[13px] transition-colors hover:bg-accent px-0"
                    key={file.id}
                  >
                    <span className="flex h-full items-center gap-1.5 overflow-hidden pl-1 font-normal">
                      <div className="relative flex h-4 min-w-4 items-center justify-center">
                        {file.preview ? (
                          <Image
                            alt={file.name}
                            className="absolute inset-0 h-4 w-4 rounded border object-cover"
                            src={file.preview}
                            width={16}
                            height={16}
                          />
                        ) : (
                          <Paperclip className="opacity-60" size={12} />
                        )}
                      </div>
                      <span className="inline overflow-hidden truncate pr-1.5 transition-all">
                        {file.name}
                      </span>
                    </span>
                    <button
                      className="absolute right-1 z-10 rounded-sm p-0.5 text-muted-foreground opacity-0 focus-visible:bg-accent focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-background group-hover:opacity-100"
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
              className="max-h-50 min-h-12 resize-none rounded-none border-none bg-transparent! p-0 text-sm shadow-none focus-visible:border-transparent focus-visible:ring-0"
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Enter a URL or describe your ad..."
              value={prompt}
              disabled={disabled}
            />

            <div className="flex items-center gap-1">
              <div className="flex items-end gap-0.5 sm:gap-1">
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
                      className="ml-[-2px] h-7 w-7 rounded-md"
                      size="icon"
                      type="button"
                      variant="ghost"
                      disabled={disabled}
                    >
                      <Plus size={16} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="max-w-xs rounded-2xl p-1.5"
                  >
                    <DropdownMenuGroup className="space-y-1">
                      <DropdownMenuItem
                        className="rounded-[calc(1rem-6px)] text-xs"
                        onClick={() => fileUploadRef.current?.click()}
                      >
                        <div className="flex items-center gap-2">
                          <Paperclip
                            className="text-muted-foreground"
                            size={16}
                          />
                          <span>Attach Files</span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="rounded-[calc(1rem-6px)] text-xs">
                        <div className="flex items-center gap-2">
                          <LinkIcon
                            className="text-muted-foreground"
                            size={16}
                          />
                          <span>Import from URL</span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="rounded-[calc(1rem-6px)] text-xs">
                        <div className="flex items-center gap-2">
                          <Clipboard
                            className="text-muted-foreground"
                            size={16}
                          />
                          <span>Paste from Clipboard</span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="rounded-[calc(1rem-6px)] text-xs">
                        <div className="flex items-center gap-2">
                          <LayoutTemplate
                            className="text-muted-foreground"
                            size={16}
                          />
                          <span>Use Template</span>
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      className="size-7 rounded-md"
                      size="icon"
                      type="button"
                      variant="ghost"
                      disabled={disabled}
                    >
                      <Settings2 size={16} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="w-48 rounded-2xl p-3"
                  >
                    <DropdownMenuGroup className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles
                            className="text-muted-foreground"
                            size={16}
                          />
                          <Label className="text-xs">Auto-complete</Label>
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
                          <Play className="text-muted-foreground" size={16} />
                          <Label className="text-xs">Streaming</Label>
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
                          <History
                            className="text-muted-foreground"
                            size={16}
                          />
                          <Label className="text-xs">Show History</Label>
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
              </div>

              <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
                <Button
                  className="h-7 w-7 rounded-md"
                  disabled={!prompt.trim() || disabled}
                  size="icon"
                  type="submit"
                  variant="default"
                >
                  <ArrowUp size={16} />
                </Button>
              </div>
            </div>

            <div
              className={cn(
                "absolute inset-0 flex items-center justify-center pointer-events-none z-20 rounded-[inherit] border border-border border-dashed bg-muted text-foreground text-sm transition-opacity duration-200",
                isDragOver ? "opacity-100" : "opacity-0"
              )}
            >
              <span className="flex w-full items-center justify-center gap-1 font-medium">
                <CirclePlus className="min-w-4" size={16} />
                Drop files here to add as attachments
              </span>
            </div>
          </form>
        </div>

        <div className="max-w-250 mx-auto flex-wrap gap-3 flex min-h-0 shrink-0 items-center justify-center">
          {ACTIONS.map((action) => (
            <Button
              className="gap-2 rounded-full"
              key={action.id}
              size="sm"
              variant="outline"
              disabled={disabled}
            >
              <action.icon size={16} />
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
              prompt && "bg-primary hover:bg-primary/90!"
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
