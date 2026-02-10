import { Clapperboard, Sparkles, Camera, AudioLines } from "lucide-react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { UploadSession } from "~/lib/upload-session";
import { formatDuration } from "../utils";
import { useProject } from "~/providers/ProjectProvider";

interface EditorPlayerProps {
  upload: UploadSession | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoError: string | null;
  isBackgroundUploading: boolean;
  uploadNotice: string | null;
  signInHref: string;
  handleVideoError: () => void;
  onFileSelect: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export function EditorPlayer({
  upload,
  videoRef,
  videoError,
  isBackgroundUploading,
  uploadNotice,
  signInHref,
  handleVideoError,
  onFileSelect,
  inputRef,
  onInputChange,
}: EditorPlayerProps) {
  const { localVideoUrl } = useProject();

  // Prioritize localVideoUrl from context if available
  const videoSrc = localVideoUrl || upload?.url;

  return (
    <div className="editor-stage aspect-[16/9]">
      {videoSrc ? (
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          src={videoSrc}
          poster={upload?.posterUrl ?? undefined}
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
              Local preview starts instantly.
            </p>
          </div>
          <Button
            variant="accent"
            className="rounded-full px-6"
            disabled={isBackgroundUploading}
            onClick={onFileSelect}
          >
            {isBackgroundUploading ? "Uploading..." : "Choose a video"}
          </Button>
          {videoError ? (
            <div className="space-y-2">
              <p className="text-sm text-[color:var(--editor-accent)]">
                {videoError}
              </p>
              {videoError.toLowerCase().includes("authentication") ? (
                <Button
                  variant="glass"
                  size="sm"
                  className="rounded-full px-4"
                  asChild
                >
                  <Link href={signInHref}>Sign in to continue</Link>
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {videoSrc ? (
        <div className="absolute left-6 top-6 flex items-center gap-3 rounded-full bg-black/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/70 backdrop-blur">
          <span>Footage</span>
          {upload?.durationMs ? (
            <span>{formatDuration(upload.durationMs)}</span>
          ) : null}
          {upload?.width && upload?.height ? (
            <span>
              {upload.width}x{upload.height}
            </span>
          ) : null}
          <Button
            variant="glass"
            size="sm"
            className="rounded-full px-4"
            disabled={isBackgroundUploading}
            onClick={onFileSelect}
          >
            Replace
          </Button>
        </div>
      ) : null}

      {videoSrc ? (
        <div className="absolute right-6 bottom-6 flex items-center gap-2 rounded-full bg-[color:var(--editor-accent)] px-4 py-3 text-[#1a1a14] shadow-[0_20px_45px_rgba(216,221,90,0.45)]">
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-full bg-black/10 leading-none"
          >
            <Sparkles className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-full bg-black/10 leading-none"
          >
            <Camera className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-full bg-black/10 leading-none"
          >
            <AudioLines className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {uploadNotice ? (
        <div className="absolute left-6 bottom-6 rounded-full bg-black/55 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/75 backdrop-blur">
          {uploadNotice}
        </div>
      ) : null}

      <Input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={onInputChange}
      />
    </div>
  );
}
