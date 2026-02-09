import {
  completeAssetUpload,
  createAssetUploadSession,
  getAsset,
  type AssetRecord,
} from "~/lib/assets-api";

const DEFAULT_VIDEO_MIME = "video/mp4";
const POSTER_MIME = "image/jpeg";

type VideoMetadata = {
  durationMs: number;
  width: number;
  height: number;
};

type PosterData = VideoMetadata & {
  blob: Blob;
};

function getVideoDurationMs(durationSeconds: number) {
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
    return 0;
  }

  return Math.round(durationSeconds * 1000);
}

function waitForVideoEvent(video: HTMLVideoElement, event: keyof HTMLMediaElementEventMap) {
  return new Promise<void>((resolve, reject) => {
    const onResolve = () => {
      cleanup();
      resolve();
    };
    const onReject = () => {
      cleanup();
      reject(new Error(`Video event failed: ${event}`));
    };
    const cleanup = () => {
      video.removeEventListener(event, onResolve);
      video.removeEventListener("error", onReject);
    };

    video.addEventListener(event, onResolve, { once: true });
    video.addEventListener("error", onReject, { once: true });
  });
}

function createPosterBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to generate poster image"));
          return;
        }

        resolve(blob);
      },
      POSTER_MIME,
      0.86,
    );
  });
}

async function extractPosterData(file: File) {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.src = objectUrl;

  try {
    await waitForVideoEvent(video, "loadedmetadata");
    await waitForVideoEvent(video, "loadeddata");

    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    if (sourceWidth <= 0 || sourceHeight <= 0) {
      throw new Error("Unable to read video dimensions");
    }
    const maxWidth = 960;
    const outputWidth = Math.min(sourceWidth, maxWidth);
    const outputHeight = Math.max(
      1,
      Math.round((outputWidth / sourceWidth) * sourceHeight),
    );

    const canvas = document.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = outputHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas 2D context unavailable");
    }

    context.drawImage(video, 0, 0, outputWidth, outputHeight);
    const blob = await createPosterBlob(canvas);

    return {
      blob,
      durationMs: getVideoDurationMs(video.duration),
      width: sourceWidth,
      height: sourceHeight,
    } satisfies PosterData;
  } finally {
    URL.revokeObjectURL(objectUrl);
    video.removeAttribute("src");
    video.load();
  }
}

async function putObject(putUrl: string, body: Blob | File, mime: string) {
  const response = await fetch(putUrl, {
    method: "PUT",
    headers: {
      "content-type": mime,
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Upload failed (${response.status})`);
  }
}

function toPosterFileName(fileName: string) {
  const baseName = fileName.replace(/\.[^/.]+$/, "");
  return `${baseName || "upload"}-poster.jpg`;
}

export async function uploadVideoWithPoster(
  projectId: string,
  file: File,
): Promise<{ videoAsset: AssetRecord; posterAsset: AssetRecord }> {
  const videoMime = file.type || DEFAULT_VIDEO_MIME;
  const videoSession = await createAssetUploadSession(projectId, {
    fileName: file.name,
    mime: videoMime,
    size: file.size,
    type: "video",
  });

  const [posterData] = await Promise.all([
    extractPosterData(file),
    putObject(videoSession.putUrl, file, videoMime),
  ]);

  const posterSession = await createAssetUploadSession(projectId, {
    fileName: toPosterFileName(file.name),
    mime: POSTER_MIME,
    size: posterData.blob.size,
    type: "poster",
  });

  await putObject(posterSession.putUrl, posterData.blob, POSTER_MIME);
  const completedPoster = await completeAssetUpload(posterSession.assetId, {
    size: posterData.blob.size,
    width: posterData.width,
    height: posterData.height,
  });

  const completedVideo = await completeAssetUpload(videoSession.assetId, {
    size: file.size,
    durationMs: posterData.durationMs,
    width: posterData.width,
    height: posterData.height,
    posterAssetId: completedPoster.asset.id,
  });

  const finalVideo = await getAsset(completedVideo.asset.id);

  return {
    videoAsset: finalVideo.asset,
    posterAsset: completedPoster.asset,
  };
}
