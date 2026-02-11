import {
  SInterpretPlaybackRequest,
  type TInterpretPlaybackResponse,
} from "@doujin/shared/types";

export class PlaybackCommandError extends Error {
  public readonly status: number;
  public readonly code: string | null;
  public readonly retryAfterSeconds: number | null;
  public readonly creditsLimit: number | null;
  public readonly creditsRemaining: number | null;
  public readonly creditsResetIso: string | null;

  constructor(args: {
    status: number;
    message: string;
    code: string | null;
    retryAfterSeconds: number | null;
    creditsLimit: number | null;
    creditsRemaining: number | null;
    creditsResetIso: string | null;
  }) {
    super(args.message);
    this.status = args.status;
    this.code = args.code;
    this.retryAfterSeconds = args.retryAfterSeconds;
    this.creditsLimit = args.creditsLimit;
    this.creditsRemaining = args.creditsRemaining;
    this.creditsResetIso = args.creditsResetIso;
  }
}

export async function interpretTPlaybackCommand(args: {
  prompt: string;
  currentMs?: number;
  durationMs?: number;
}): Promise<TInterpretPlaybackResponse> {
  const payload = SInterpretPlaybackRequest.parse(args);

  const response = await fetch("/api/editor/interpret", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const code = typeof body?.error?.code === "string" ? body.error.code : null;
    const message =
      typeof body?.error?.message === "string"
        ? body.error.message
        : "Failed to interpret command";

    const retryAfterHeader = response.headers.get("retry-after");
    const retryAfterSeconds = retryAfterHeader
      ? Number.parseInt(retryAfterHeader, 10)
      : null;

    const creditsLimitHeader = response.headers.get("x-ai-credits-limit");
    const creditsRemainingHeader = response.headers.get(
      "x-ai-credits-remaining",
    );
    const creditsResetIso = response.headers.get("x-ai-credits-reset");

    const creditsLimit = creditsLimitHeader
      ? Number.parseInt(creditsLimitHeader, 10)
      : null;
    const creditsRemaining = creditsRemainingHeader
      ? Number.parseInt(creditsRemainingHeader, 10)
      : null;

    throw new PlaybackCommandError({
      status: response.status,
      message,
      code,
      retryAfterSeconds:
        Number.isFinite(retryAfterSeconds) && retryAfterSeconds !== null
          ? retryAfterSeconds
          : null,
      creditsLimit: Number.isFinite(creditsLimit) ? creditsLimit : null,
      creditsRemaining: Number.isFinite(creditsRemaining)
        ? creditsRemaining
        : null,
      creditsResetIso:
        typeof creditsResetIso === "string" ? creditsResetIso : null,
    });
  }

  return response.json();
}

export function executeTPlaybackCommand(
  video: HTMLVideoElement,
  command: TInterpretPlaybackResponse["command"],
) {
  switch (command.type) {
    case "play":
      void video.play();
      break;
    case "pause":
      video.pause();
      break;
    case "seek":
      video.currentTime = command.toMs / 1000;
      break;
    case "none":
      // No-op or show message
      break;
  }
}
