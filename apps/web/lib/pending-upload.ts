type PendingUploadEntry = {
  file: File;
  inFlight: boolean;
};

const pendingUploads = new Map<string, PendingUploadEntry>();

export const setPendingUpload = (projectId: string, file: File) => {
  pendingUploads.set(projectId, { file, inFlight: false });
};

export const getPendingUpload = (projectId: string) => {
  return pendingUploads.get(projectId)?.file ?? null;
};

export const claimPendingUpload = (projectId: string) => {
  const entry = pendingUploads.get(projectId);
  if (!entry || entry.inFlight) {
    return null;
  }

  entry.inFlight = true;
  pendingUploads.set(projectId, entry);
  return entry.file;
};

export const clearPendingUpload = (projectId: string) => {
  pendingUploads.delete(projectId);
};
