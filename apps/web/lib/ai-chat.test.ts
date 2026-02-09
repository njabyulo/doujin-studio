import { describe, expect, it, vi } from "vitest";
import { ApiClientError } from "./assets-api";
import {
  createAiChatContext,
  createAiChatRequestBody,
  flushTimelineBeforeAiSend,
  refreshTimelineAfterAi,
} from "./ai-chat";
import {
  createDefaultTimelineData,
  type EditorTimelineState,
} from "./timeline-state";
import type { TimelineWithLatestResponse } from "./timelines-api";

function createTimelineState(
  overrides: Partial<EditorTimelineState> = {},
): EditorTimelineState {
  return {
    timelineId: "timeline-1",
    baseVersion: 1,
    data: createDefaultTimelineData(),
    saveStatus: "saved",
    lastSavedAt: Date.now(),
    source: "system",
    error: null,
    ...overrides,
  };
}

function createTimelineResponse(version: number): TimelineWithLatestResponse {
  const data = createDefaultTimelineData();

  return {
    timeline: {
      id: "timeline-1",
      projectId: "project-1",
      name: "Main Timeline",
      latestVersion: version,
      createdAt: 1,
      updatedAt: 2,
    },
    latestVersion: {
      id: `timeline-version-${version}`,
      timelineId: "timeline-1",
      version,
      source: "ai",
      createdByUserId: "user-1",
      createdAt: 3,
      data,
    },
  };
}

describe("ai chat helpers", () => {
  it("builds request payloads with timelineId and context mode", () => {
    const data = createDefaultTimelineData();
    const context = createAiChatContext(data, {
      mode: "phase2",
      notes: "Use tighter pacing on the intro.",
      keyframes: [
        {
          timestampMs: 1200,
          imageUrl: "https://example.com/frame-1.jpg",
        },
      ],
    });

    const payload = createAiChatRequestBody({
      timelineId: "timeline-1",
      messages: [
        {
          role: "user",
          parts: [{ type: "text", text: "trim clip 1 to 3s" }],
        },
      ],
      context,
    });

    expect(payload.timelineId).toBe("timeline-1");
    expect(payload.context?.mode).toBe("phase2");
    expect(payload.context?.timelineMetadata?.clipCount).toBe(0);
  });

  it("refreshes timeline state after ai response and persists cache", async () => {
    const response = createTimelineResponse(3);
    const getTimeline = vi.fn().mockResolvedValue(response);
    const persistTimelineCache = vi.fn();
    const toEditorTimelineState = vi.fn(
      (payload: TimelineWithLatestResponse): EditorTimelineState => ({
        timelineId: payload.timeline.id,
        baseVersion: payload.latestVersion.version,
        data: payload.latestVersion.data,
        saveStatus: "saved",
        lastSavedAt: 10,
        source: payload.latestVersion.source,
        error: null,
      }),
    );

    const nextState = await refreshTimelineAfterAi({
      timelineId: "timeline-1",
      getTimeline,
      toEditorTimelineState,
      persistTimelineCache,
    });

    expect(getTimeline).toHaveBeenCalledWith("timeline-1");
    expect(toEditorTimelineState).toHaveBeenCalledWith(response, "saved");
    expect(persistTimelineCache).toHaveBeenCalledWith(nextState);
    expect(nextState.baseVersion).toBe(3);
  });

  it("returns current state immediately when no dirty timeline exists", async () => {
    const timelineState = createTimelineState({ saveStatus: "saved" });
    const patchTimeline = vi.fn();

    const result = await flushTimelineBeforeAiSend({
      timelineState,
      patchTimeline,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.baseVersion).toBe(1);
    }
    expect(patchTimeline).not.toHaveBeenCalled();
  });

  it("flushes dirty timeline edits before chat send", async () => {
    const timelineState = createTimelineState({
      saveStatus: "dirty",
      baseVersion: 2,
    });
    const patchResponse = createTimelineResponse(3);
    const patchTimeline = vi.fn().mockResolvedValue(patchResponse);

    const result = await flushTimelineBeforeAiSend({
      timelineState,
      patchTimeline,
    });

    expect(patchTimeline).toHaveBeenCalledWith("timeline-1", {
      baseVersion: 2,
      source: "autosave",
      data: timelineState.data,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.baseVersion).toBe(3);
    }
  });

  it("blocks send on timeline conflict or auth failures while flushing", async () => {
    const timelineState = createTimelineState({ saveStatus: "dirty" });
    const conflictPatch = vi
      .fn()
      .mockRejectedValue(
        new ApiClientError(400, "BAD_REQUEST", "Timeline version conflict"),
      );
    const authPatch = vi
      .fn()
      .mockRejectedValue(
        new ApiClientError(401, "UNAUTHORIZED", "Authentication required"),
      );

    const conflict = await flushTimelineBeforeAiSend({
      timelineState,
      patchTimeline: conflictPatch,
    });
    const auth = await flushTimelineBeforeAiSend({
      timelineState,
      patchTimeline: authPatch,
    });

    expect(conflict.ok).toBe(false);
    if (!conflict.ok) {
      expect(conflict.error).toContain("Timeline conflict detected");
    }

    expect(auth.ok).toBe(false);
    if (!auth.ok) {
      expect(auth.error).toContain("Authentication required");
    }
  });
});
