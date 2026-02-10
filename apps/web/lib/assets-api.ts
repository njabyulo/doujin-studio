import type {
  TMeResponse,
  TProject,
  TAssetType,
  TAssetStatus,
  TAsset,
  TAssetResponse,
  TProjectAssetListResponse,
} from "@doujin/core";

export type {
  TMeResponse,
  TProject,
  TAssetType,
  TAssetStatus,
  TAsset,
  TAssetResponse,
  TProjectAssetListResponse,
};

// Aliases for compatibility
export type AssetRecord = TAsset;

type ApiErrorShape = {
  error?: {
    code?: string;
    message?: string;
  };
};

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

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

export function resolveApiAssetUrl(pathOrUrl: string) {
  if (!pathOrUrl.startsWith("/")) {
    return pathOrUrl;
  }

  return createApiUrl(pathOrUrl);
}

export async function getMe() {
  return apiRequest<TMeResponse>("/api/me", { method: "GET" });
}

export async function createProject(input: { title: string }) {
  return apiRequest<{ project: TProject }>("/api/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// R2 upload session and complete calls removed

export async function getAsset(assetId: string) {
  return apiRequest<TAssetResponse>(`/api/assets/${assetId}`, {
    method: "GET",
  });
}

export async function listProjectAssets(
  projectId: string,
  query?: {
    type?: TAssetType;
    status?: TAssetStatus;
    limit?: number;
  },
) {
  const search = new URLSearchParams();
  if (query?.type) {
    search.set("type", query.type);
  }
  if (query?.status) {
    search.set("status", query.status);
  }
  if (query?.limit) {
    search.set("limit", String(query.limit));
  }

  const queryString = search.toString();
  const path = queryString
    ? `/api/projects/${projectId}/assets?${queryString}`
    : `/api/projects/${projectId}/assets`;

  return apiRequest<TProjectAssetListResponse>(path, {
    method: "GET",
  });
}
