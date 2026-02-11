type PendingAuthUploadMetadata = {
  fileName: string;
  mime: string;
  size: number;
  createdAt: number;
};

const STORAGE_KEY = "doujin:pending-auth-upload";

let pendingFile: File | null = null;

const parseMetadata = (raw: string) => {
  try {
    const value = JSON.parse(raw) as PendingAuthUploadMetadata;
    if (!value?.fileName || typeof value.size !== "number") {
      return null;
    }

    return value;
  } catch {
    return null;
  }
};

const readMetadata = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  return parseMetadata(raw);
};

const writeMetadata = (file: File) => {
  if (typeof window === "undefined") {
    return;
  }

  const metadata: PendingAuthUploadMetadata = {
    fileName: file.name,
    mime: file.type || "video/mp4",
    size: file.size,
    createdAt: Date.now(),
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(metadata));
};

export const savePendingAuthUpload = (file: File) => {
  pendingFile = file;
  writeMetadata(file);
};

export const claimPendingAuthUploadFile = () => {
  const file = pendingFile;
  pendingFile = null;
  return file;
};

export const getPendingAuthUploadMetadata = () => {
  return readMetadata();
};

export const clearPendingAuthUpload = () => {
  pendingFile = null;
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.removeItem(STORAGE_KEY);
};
