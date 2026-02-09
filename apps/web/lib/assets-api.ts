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

type ProjectResponse = {
  project: {
    id: string;
    title: string;
    role: "owner";
  };
};

type MeResponse = {
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  };
  tenant: {
    type: "user";
    id: string;
  };
};

export type AssetType = "video" | "poster";
export type AssetStatus = "pending_upload" | "uploaded" | "upload_failed";

export type AssetRecord = {
  id: string;
  projectId: string;
  type: AssetType;
  status: AssetStatus;
  r2Key: string;
  size: number;
  mime: string;
  checksumSha256: string | null;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  posterAssetId: string | null;
  createdAt: number;
  fileUrl: string;
  posterUrl: string | null;
};

type AssetResponse = {
  asset: AssetRecord;
};

type UploadSessionResponse = {
  assetId: string;
  putUrl: string;
  r2Key: string;
};

type ProjectAssetListResponse = {
  assets: AssetRecord[];
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

export function resolveApiAssetUrl(pathOrUrl: string) {
  if (!pathOrUrl.startsWith("/")) {
    return pathOrUrl;
  }

  return createApiUrl(pathOrUrl);
}

export async function getMe() {
  return apiRequest<MeResponse>("/api/me", { method: "GET" });
}

export async function createProject(input: { title: string }) {
  return apiRequest<ProjectResponse>("/api/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function createAssetUploadSession(
  projectId: string,
  input: {
    fileName: string;
    mime: string;
    size: number;
    type: AssetType;
  },
) {
  return apiRequest<UploadSessionResponse>(
    `/api/projects/${projectId}/assets/upload-session`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function completeAssetUpload(
  assetId: string,
  input: {
    size: number;
    checksumSha256?: string;
    durationMs?: number;
    width?: number;
    height?: number;
    posterAssetId?: string;
  },
) {
  return apiRequest<AssetResponse>(`/api/assets/${assetId}/complete`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getAsset(assetId: string) {
  return apiRequest<AssetResponse>(`/api/assets/${assetId}`, {
    method: "GET",
  });
}

export async function listProjectAssets(
  projectId: string,
  query?: {
    type?: AssetType;
    status?: AssetStatus;
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

  return apiRequest<ProjectAssetListResponse>(path, {
    method: "GET",
  });
}
