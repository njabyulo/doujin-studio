import {
  applyEditorCommand as applyEditorCommandCore,
  createDefaultTimelineData as createDefaultTimelineDataCore,
  type EditorCommand,
} from "@doujin/contracts";
import type { TimelineData, TimelineVersionSource } from "./timelines-api";

export type { EditorCommand };

const TIMELINE_CACHE_VERSION = "v1";
const TIMELINE_CACHE_PREFIX = `doujin:timeline-cache:${TIMELINE_CACHE_VERSION}:`;

export type EditorSaveStatus =
  | "idle"
  | "dirty"
  | "saving"
  | "saved"
  | "error"
  | "conflict";

export type EditorTimelineState = {
  timelineId: string;
  baseVersion: number;
  data: TimelineData;
  saveStatus: EditorSaveStatus;
  lastSavedAt: number | null;
  source: TimelineVersionSource;
  error: string | null;
};

type CachedTimelineState = {
  timelineId: string;
  baseVersion: number;
  data: TimelineData;
};

function getTimelineCacheKey(projectId: string) {
  return `${TIMELINE_CACHE_PREFIX}${projectId}`;
}

export function createDefaultTimelineData() {
  return createDefaultTimelineDataCore();
}

export function applyEditorCommand(
  data: TimelineData,
  command: EditorCommand,
): TimelineData {
  return applyEditorCommandCore(data, command);
}

export function saveEditorTimelineCache(projectId: string, state: CachedTimelineState) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    sessionStorage.setItem(getTimelineCacheKey(projectId), JSON.stringify(state));
  } catch {
    // ignore storage errors for private mode / quota limits
  }
}

export function loadEditorTimelineCache(projectId: string): CachedTimelineState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = sessionStorage.getItem(getTimelineCacheKey(projectId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as CachedTimelineState;
    if (
      !parsed ||
      typeof parsed.timelineId !== "string" ||
      typeof parsed.baseVersion !== "number" ||
      !parsed.data
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function clearEditorTimelineCache(projectId: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    sessionStorage.removeItem(getTimelineCacheKey(projectId));
  } catch {
    // ignore storage errors
  }
}
