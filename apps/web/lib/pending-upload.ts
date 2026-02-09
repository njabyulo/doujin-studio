type PendingUploadEntry = {
  file: File;
  inFlight: boolean;
};

const pendingUploads = new Map<string, PendingUploadEntry>();

export function setPendingUpload(projectId: string, file: File) {
  pendingUploads.set(projectId, { file, inFlight: false });
}

export function getPendingUpload(projectId: string) {
  return pendingUploads.get(projectId)?.file ?? null;
}

export function claimPendingUpload(projectId: string) {
  const entry = pendingUploads.get(projectId);
  if (!entry || entry.inFlight) {
    return null;
  }

  entry.inFlight = true;
  pendingUploads.set(projectId, entry);
  return entry.file;
}

export function clearPendingUpload(projectId: string) {
  pendingUploads.delete(projectId);
}
