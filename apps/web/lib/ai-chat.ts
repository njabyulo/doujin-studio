import type {
  AiChatContext,
  AiChatContextMode,
  AiChatKeyframe,
  AiChatRequest,
  AiChatTranscriptSegment,
  AiChatVideoRef,
} from "@doujin/contracts";
import { ApiClientError } from "./assets-api";
import type { EditorSaveStatus, EditorTimelineState } from "./timeline-state";
import type { TimelineData, TimelineWithLatestResponse } from "./timelines-api";

type MinimalChatMessage = {
  id?: string;
  role: "system" | "user" | "assistant" | "tool";
  parts?: unknown[];
  metadata?: unknown;
};

type FlushSuccess = {
  ok: true;
  state: Pick<EditorTimelineState, "timelineId" | "baseVersion" | "data">;
};

type FlushFailure = {
  ok: false;
  error: string;
};

export function countTimelineClips(data: TimelineData) {
  return data.tracks.reduce((total, track) => total + track.clips.length, 0);
}

export function createAiChatContext(
  data: TimelineData,
  options?: {
    mode?: AiChatContextMode;
    notes?: string;
    transcript?: AiChatTranscriptSegment[];
    keyframes?: AiChatKeyframe[];
    videoRef?: AiChatVideoRef;
  },
): AiChatContext {
  return {
    mode: options?.mode ?? "phase1",
    timelineMetadata: {
      fps: data.fps,
      durationMs: data.durationMs,
      trackCount: data.tracks.length,
      clipCount: countTimelineClips(data),
    },
    notes: options?.notes,
    transcript: options?.transcript,
    keyframes: options?.keyframes,
    videoRef: options?.videoRef,
  };
}

export function createAiChatRequestBody(input: {
  timelineId: string;
  messages: MinimalChatMessage[];
  context: AiChatContext;
}): AiChatRequest {
  return {
    timelineId: input.timelineId,
    messages: input.messages,
    context: input.context,
  };
}

export async function refreshTimelineAfterAi(input: {
  timelineId: string;
  getTimeline: (timelineId: string) => Promise<TimelineWithLatestResponse>;
  toEditorTimelineState: (
    payload: TimelineWithLatestResponse,
    saveStatus?: EditorSaveStatus,
  ) => EditorTimelineState;
  persistTimelineCache: (nextState: EditorTimelineState) => void;
}) {
  const refreshed = await input.getTimeline(input.timelineId);
  const nextState = input.toEditorTimelineState(refreshed, "saved");
  input.persistTimelineCache(nextState);
  return nextState;
}

export async function flushTimelineBeforeAiSend(input: {
  timelineState: EditorTimelineState | null;
  patchTimeline: (timelineId: string, payload: {
    baseVersion: number;
    source?: "autosave";
    data: TimelineData;
  }) => Promise<TimelineWithLatestResponse>;
}): Promise<FlushSuccess | FlushFailure> {
  const { timelineState, patchTimeline } = input;
  if (!timelineState) {
    return {
      ok: false,
      error: "Timeline is still loading. Try again in a moment.",
    };
  }

  if (timelineState.saveStatus !== "dirty") {
    return {
      ok: true,
      state: {
        timelineId: timelineState.timelineId,
        baseVersion: timelineState.baseVersion,
        data: timelineState.data,
      },
    };
  }

  try {
    const saved = await patchTimeline(timelineState.timelineId, {
      baseVersion: timelineState.baseVersion,
      source: "autosave",
      data: timelineState.data,
    });

    return {
      ok: true,
      state: {
        timelineId: saved.timeline.id,
        baseVersion: saved.latestVersion.version,
        data: saved.latestVersion.data,
      },
    };
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 400) {
      return {
        ok: false,
        error: "Timeline conflict detected. Refresh to sync latest edits before chatting.",
      };
    }

    if (error instanceof ApiClientError && error.status === 401) {
      return {
        ok: false,
        error: "Authentication required to save timeline edits before chatting.",
      };
    }

    return {
      ok: false,
      error: "Could not save pending edits before chatting.",
    };
  }
}
