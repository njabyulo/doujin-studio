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

const getApiBaseUrl = () => {
  if (typeof window !== "undefined") {
    return "";
  }
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ?? "";
  return configured.endsWith("/") ? configured.slice(0, -1) : configured;
};

const createApiUrl = (path: string) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = getApiBaseUrl();
  return base ? `${base}${normalizedPath}` : normalizedPath;
};

const readJson = async (response: Response) => {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  return response.json();
};

const apiRequest = async <T>(path: string, init?: RequestInit) => {
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
};

export const createProjectTimeline = async (
  projectId: string,
  input: {
    name?: string;
    seedAssetId?: string;
  },
) => {
  return apiRequest<TTimelineWithLatestResponse>(
    `/api/projects/${projectId}/timelines`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
};

export const getProjectLatestTimeline = async (projectId: string) => {
  return apiRequest<TTimelineWithLatestResponse>(
    `/api/projects/${projectId}/timelines/latest`,
    {
      method: "GET",
    },
  );
};

export const getTimeline = async (timelineId: string) => {
  return apiRequest<TTimelineWithLatestResponse>(
    `/api/timelines/${timelineId}`,
    {
      method: "GET",
    },
  );
};

export const patchTimeline = async (
  timelineId: string,
  input: {
    baseVersion: number;
    source?: TTimelineVersionSource;
    data: TTimelineData;
  },
) => {
  return apiRequest<TTimelineWithLatestResponse>(
    `/api/timelines/${timelineId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
};

export const createTimelineVersion = async (
  timelineId: string,
  input: {
    baseVersion: number;
    source?: TTimelineVersionSource;
    data: TTimelineData;
  },
) => {
  return apiRequest<TTimelineWithLatestResponse>(
    `/api/timelines/${timelineId}/versions`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
};
