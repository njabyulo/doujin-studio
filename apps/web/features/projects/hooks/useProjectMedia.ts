import { useCallback, useEffect, useState } from "react";
import {
    ApiClientError,
    listProjectAssets,
    resolveApiAssetUrl,
    type AssetRecord,
} from "~/lib/assets-api";
import {
    clearUpload,
    loadUpload,
    saveUpload,
    type UploadSession,
} from "~/lib/upload-session";
import {
    createProjectTimeline,
    type TTimelineWithLatestResponse,
} from "~/lib/timelines-api";
import { EditorTimelineState } from "~/lib/timeline-state";
import { useProject } from "~/providers/ProjectProvider";

export function useProjectMedia(
    projectId: string | undefined,
    toEditorTimelineState: (payload: TTimelineWithLatestResponse, status?: "saved" | "idle") => EditorTimelineState,
    setTimelineState: (state: EditorTimelineState | null) => void,
    persistTimelineCache: (state: EditorTimelineState) => void,
    setTimelineError: (error: string | null) => void,
    attachUploadedAssetToTimeline: (asset: AssetRecord) => void
) {
    const { localVideoFile } = useProject();
    const [upload, setUpload] = useState<UploadSession | null>(() => {
        if (localVideoFile && projectId) {
            return {
                url: URL.createObjectURL(localVideoFile),
                name: localVideoFile.name,
                size: localVideoFile.size,
                type: localVideoFile.type || "video/mp4",
                createdAt: Date.now(),
                status: "local",
                cloudUrl: null,
                posterUrl: null,
                durationMs: null,
                width: null,
                height: null,
            };
        }
        return projectId ? loadUpload(projectId) : null;
    });
    const [videoError, setVideoError] = useState<string | null>(null);
    const [uploadNotice, setUploadNotice] = useState<string | null>(null);

    const applyUploadedAsset = useCallback(
        (asset: AssetRecord, fallbackName?: string) => {
            if (!projectId) return;

            const resolvedFileUrl = resolveApiAssetUrl(asset.fileUrl);
            const resolvedPosterUrl = asset.posterUrl
                ? resolveApiAssetUrl(asset.posterUrl)
                : null;
            const nextUpload: UploadSession = {
                url: resolvedFileUrl,
                cloudUrl: resolvedFileUrl,
                posterUrl: resolvedPosterUrl,
                name: fallbackName ?? asset.r2Key.split("/").pop() ?? "upload.mp4",
                size: asset.size,
                type: asset.mime,
                assetId: asset.id,
                posterAssetId: asset.posterAssetId,
                createdAt: Date.now(),
                status: "uploaded",
                durationMs: asset.durationMs,
                width: asset.width,
                height: asset.height,
            };

            saveUpload(projectId, nextUpload);
            setUpload(nextUpload);
        },
        [projectId],
    );

    useEffect(() => {
        if (!projectId) return;

        let cancelled = false;

        const hydrateProjectState = async () => {
            try {
                const assetsResponse = await listProjectAssets(projectId, {
                    type: "video",
                    status: "uploaded",
                    limit: 1,
                });

                if (cancelled) return;

                const latestAsset = assetsResponse.assets[0];
                if (latestAsset) {
                    const local = loadUpload(projectId);
                    applyUploadedAsset(latestAsset, local?.name);
                }

                const hydratedTimeline = await createProjectTimeline(projectId, {
                    name: "Main Timeline",
                    seedAssetId: latestAsset?.id,
                });

                if (cancelled) return;

                const nextTimelineState = toEditorTimelineState(hydratedTimeline, "saved");
                setTimelineState(nextTimelineState);
                persistTimelineCache(nextTimelineState);
                setTimelineError(null);
            } catch (caughtError) {
                if (cancelled) return;

                if (
                    caughtError instanceof ApiClientError &&
                    caughtError.status === 401
                ) {
                    setVideoError("Authentication required to load project media.");
                    setTimelineError("Authentication required to load timeline data.");
                    return;
                }

                setVideoError("Could not load uploaded media for this project.");
                setTimelineError("Could not load timeline for this project.");
            }
        };

        void hydrateProjectState();

        return () => {
            cancelled = true;
        };
    }, [
        applyUploadedAsset,
        persistTimelineCache,
        projectId,
        setTimelineError,
        setTimelineState,
        toEditorTimelineState,
    ]);

    const handleVideoError = useCallback(() => {
        if (!projectId) return;
        if (upload?.cloudUrl) {
            setVideoError("Video playback failed. Try refreshing the project.");
            return;
        }

        clearUpload(projectId);
        setUpload(null);
        setVideoError("Video preview expired. Upload again to continue.");
    }, [projectId, upload?.cloudUrl]);

    // handleUpload is now primarily a project creation trigger on the landing page, 
    // but we can keep it as a no-op or simple setter if needed for late uploads.
    const handleUpload = useCallback((file?: File | null) => {
        console.warn("Direct upload in editor is currently disabled in local-first flow.");
    }, []);

    return {
        upload,
        setUpload,
        videoError,
        setVideoError,
        isBackgroundUploading: false,
        uploadNotice,
        handleUpload,
        handleVideoError,
    };
}
