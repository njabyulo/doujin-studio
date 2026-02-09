import { ApiClientError } from "./assets-api";

export type TimelineTrackKind = "video" | "audio" | "subtitle";
export type TimelineClipType = "video" | "audio" | "subtitle";
export type TimelineVersionSource = "system" | "autosave" | "manual" | "ai";

export type TimelineClip = {
  id: string;
  type: TimelineClipType;
  trackId: string;
  assetId: string | null;
  startMs: number;
  endMs: number;
  sourceStartMs: number;
  volume: number | null;
  text: string | null;
};

export type TimelineTrack = {
  id: string;
  kind: TimelineTrackKind;
  name: string;
  clips: TimelineClip[];
};

export type TimelineData = {
  schemaVersion: 1;
  fps: number;
  durationMs: number;
  tracks: TimelineTrack[];
};

export type TimelineRecord = {
  id: string;
  projectId: string;
  name: string;
  latestVersion: number;
  createdAt: number;
  updatedAt: number;
};

export type TimelineVersionRecord = {
  id: string;
  timelineId: string;
  version: number;
  source: TimelineVersionSource;
  createdByUserId: string;
  createdAt: number;
  data: TimelineData;
};

export type TimelineWithLatestResponse = {
  timeline: TimelineRecord;
  latestVersion: TimelineVersionRecord;
};

type ApiErrorShape = {
  error?: {
    code?: string;
    message?: string;
  };
};

function getApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ?? "";
  return configured.endsWith("/") ? configured.slice(0, -1) : configured;
}

function createApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = getApiBaseUrl();
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

async function readJson(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  return response.json();
}

async function apiRequest<T>(path: string, init?: RequestInit) {
  const response = await fetch(createApiUrl(path), {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const body = (await readJson(response)) as T | ApiErrorShape | null;
  if (!response.ok) {
    const errorCode =
      typeof body === "object" && body && "error" in body
        ? (body.error?.code ?? "INTERNAL_ERROR")
        : "INTERNAL_ERROR";
    const errorMessage =
      typeof body === "object" && body && "error" in body
        ? (body.error?.message ?? "Request failed")
        : "Request failed";

    throw new ApiClientError(response.status, errorCode, errorMessage);
  }

  return body as T;
}

export async function createProjectTimeline(
  projectId: string,
  input: {
    name?: string;
    seedAssetId?: string;
  },
) {
  return apiRequest<TimelineWithLatestResponse>(
    `/api/projects/${projectId}/timelines`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function getProjectLatestTimeline(projectId: string) {
  return apiRequest<TimelineWithLatestResponse>(
    `/api/projects/${projectId}/timelines/latest`,
    {
      method: "GET",
    },
  );
}

export async function getTimeline(timelineId: string) {
  return apiRequest<TimelineWithLatestResponse>(`/api/timelines/${timelineId}`, {
    method: "GET",
  });
}

export async function patchTimeline(
  timelineId: string,
  input: {
    baseVersion: number;
    source?: TimelineVersionSource;
    data: TimelineData;
  },
) {
  return apiRequest<TimelineWithLatestResponse>(`/api/timelines/${timelineId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function createTimelineVersion(
  timelineId: string,
  input: {
    baseVersion: number;
    source?: TimelineVersionSource;
    data: TimelineData;
  },
) {
  return apiRequest<TimelineWithLatestResponse>(
    `/api/timelines/${timelineId}/versions`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}
