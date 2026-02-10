import { useCallback, useMemo, useState } from "react";
import { loadUpload, type UploadSession } from "~/lib/upload-session";
import { useProject } from "~/providers/ProjectProvider";

function isVideoFile(file: File) {
  return file.type.startsWith("video/") || /\.(mp4|mov|webm)$/i.test(file.name);
}

export function useProjectMedia(projectId: string | undefined) {
  const { localVideoFile, localVideoUrl, setLocalVideoFile } = useProject();

  const cachedUpload = useMemo(() => (projectId ? loadUpload(projectId) : null), [projectId]);

  const upload = useMemo<UploadSession | null>(() => {
    if (localVideoFile && localVideoUrl) {
      return {
        url: localVideoUrl,
        name: localVideoFile.name,
        size: localVideoFile.size,
        type: localVideoFile.type || "video/mp4",
        createdAt: localVideoFile.lastModified || 0,
        status: "local",
        cloudUrl: null,
        posterUrl: null,
        durationMs: null,
        width: null,
        height: null,
      };
    }

    return cachedUpload;
  }, [cachedUpload, localVideoFile, localVideoUrl]);

  const [videoError, setVideoError] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  const handleVideoError = useCallback(() => {
    setVideoError("Video playback failed. Try selecting the file again.");
  }, []);

  const handleUpload = useCallback(
    (file?: File | null) => {
      if (!file) return;
      if (!isVideoFile(file)) {
        setVideoError("Please upload a valid video file.");
        return;
      }

      setVideoError(null);
      setUploadNotice(null);
      setLocalVideoFile(file);
    },
    [setLocalVideoFile],
  );

  return {
    upload,
    videoError,
    setVideoError,
    isBackgroundUploading: false,
    uploadNotice,
    setUploadNotice,
    handleUpload,
    handleVideoError,
  };
}
