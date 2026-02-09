export type UploadSession = {
  url: string;
  name: string;
  size: number;
  type: string;
  createdAt: number;
  assetId?: string;
  posterAssetId?: string | null;
  cloudUrl?: string | null;
  posterUrl?: string | null;
  status?: "local" | "uploading" | "uploaded" | "error";
  durationMs?: number | null;
  width?: number | null;
  height?: number | null;
};

const STORAGE_PREFIX = "doujin:upload:";

function getStorageKey(projectId: string) {
  return `${STORAGE_PREFIX}${projectId}`;
}

function isReloadNavigation() {
  if (typeof performance === "undefined") return false;
  const entries = performance.getEntriesByType("navigation");
  const nav = entries[0] as PerformanceNavigationTiming | undefined;
  return nav?.type === "reload";
}

function parseSession(raw: string): UploadSession | null {
  try {
    const parsed = JSON.parse(raw) as UploadSession;
    if (!parsed?.url) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveUpload(projectId: string, payload: Omit<UploadSession, "createdAt">) {
  if (typeof window === "undefined") return;
  const key = getStorageKey(projectId);
  const existingRaw = sessionStorage.getItem(key);
  const existing = existingRaw ? parseSession(existingRaw) : null;

  if (existing?.url && existing.url !== payload.url && existing.url.startsWith("blob:")) {
    URL.revokeObjectURL(existing.url);
  }

  const value: UploadSession = {
    ...payload,
    createdAt: Date.now(),
  };
  sessionStorage.setItem(key, JSON.stringify(value));
}

export function loadUpload(projectId: string): UploadSession | null {
  if (typeof window === "undefined") return null;
  const key = getStorageKey(projectId);
  const raw = sessionStorage.getItem(key);
  if (!raw) return null;

  if (isReloadNavigation()) {
    sessionStorage.removeItem(key);
    return null;
  }

  return parseSession(raw);
}

export function clearUpload(projectId: string) {
  if (typeof window === "undefined") return;
  const key = getStorageKey(projectId);
  const raw = sessionStorage.getItem(key);
  const existing = raw ? parseSession(raw) : null;
  if (existing?.url?.startsWith("blob:")) {
    URL.revokeObjectURL(existing.url);
  }
  sessionStorage.removeItem(key);
}
