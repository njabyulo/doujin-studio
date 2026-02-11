import { ApiClientError } from "./assets-api";
import type {
  TTimelineTrackKind,
  TTimelineClipType,
  TTimelineVersionSource,
  TTimelineClip,
  TTimelineTrack,
  TTimelineData,
  TTimeline,
  TTimelineVersion,
  TTimelineWithLatestResponse,
} from "@doujin/shared/types";

export type {
  TTimelineTrackKind,
  TTimelineClipType,
  TTimelineVersionSource,
  TTimelineClip,
  TTimelineTrack,
  TTimelineData,
  TTimeline,
  TTimelineVersion,
  TTimelineWithLatestResponse,
};

// Aliases for backward compatibility if needed, or just use the T-prefixed ones
export type TimelineTrackKind = TTimelineTrackKind;
export type TimelineTrack = TTimelineTrack;
export type TimelineData = TTimelineData;
export type TimelineRecord = TTimeline;
export type TimelineVersionRecord = TTimelineVersion;

type ApiErrorShape = {
  error?: {
    code?: string;
    message?: string;
  };
};

function getApiBaseUrl() {
  if (typeof window !== "undefined") {
    return "";
  }
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
  return apiRequest<TTimelineWithLatestResponse>(
    `/api/projects/${projectId}/timelines`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function getProjectLatestTimeline(projectId: string) {
  return apiRequest<TTimelineWithLatestResponse>(
    `/api/projects/${projectId}/timelines/latest`,
    {
      method: "GET",
    },
  );
}

export async function getTimeline(timelineId: string) {
  return apiRequest<TTimelineWithLatestResponse>(
    `/api/timelines/${timelineId}`,
    {
      method: "GET",
    },
  );
}

export async function patchTimeline(
  timelineId: string,
  input: {
    baseVersion: number;
    source?: TTimelineVersionSource;
    data: TTimelineData;
  },
) {
  return apiRequest<TTimelineWithLatestResponse>(
    `/api/timelines/${timelineId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export async function createTimelineVersion(
  timelineId: string,
  input: {
    baseVersion: number;
    source?: TTimelineVersionSource;
    data: TTimelineData;
  },
) {
  return apiRequest<TTimelineWithLatestResponse>(
    `/api/timelines/${timelineId}/versions`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}
