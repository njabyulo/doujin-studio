import { useCallback, useEffect, useRef, useState } from "react";
import { TTimelineWithLatestResponse } from "@doujin/core";
import { ApiClientError } from "~/lib/assets-api";
import {
    createTimelineVersion,
    patchTimeline,
} from "~/lib/timelines-api";
import {
    applyEditorCommand,
    loadEditorTimelineCache,
    saveEditorTimelineCache,
    type TEditorCommand,
    type EditorSaveStatus,
    type EditorTimelineState,
} from "~/lib/timeline-state";

export function useTimelineState(projectId?: string) {
    const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const timelineStateRef = useRef<EditorTimelineState | null>(null);

    const [timelineError, setTimelineError] = useState<string | null>(null);
    const [timelineState, setTimelineState] = useState<EditorTimelineState | null>(() => {
        if (!projectId) return null;
        const cached = loadEditorTimelineCache(projectId);
        if (!cached) return null;

        return {
            timelineId: cached.timelineId,
            baseVersion: cached.baseVersion,
            data: cached.data,
            saveStatus: "idle",
            lastSavedAt: null,
            source: "system",
            error: null,
        };
    });

    const toEditorTimelineState = useCallback(
        (
            payload: TTimelineWithLatestResponse,
            saveStatus: EditorSaveStatus = "saved",
        ): EditorTimelineState => ({
            timelineId: payload.timeline.id,
            baseVersion: payload.latestVersion.version,
            data: payload.latestVersion.data,
            saveStatus,
            lastSavedAt: Date.now(),
            source: payload.latestVersion.source,
            error: null,
        }),
        [],
    );

    const persistTimelineCache = useCallback(
        (nextState: EditorTimelineState) => {
            if (!projectId) return;

            saveEditorTimelineCache(projectId, {
                timelineId: nextState.timelineId,
                baseVersion: nextState.baseVersion,
                data: nextState.data,
            });
        },
        [projectId],
    );

    useEffect(() => {
        timelineStateRef.current = timelineState;
    }, [timelineState]);

    const queueAutosave = useCallback(() => {
        if (autosaveTimerRef.current) {
            clearTimeout(autosaveTimerRef.current);
        }

        autosaveTimerRef.current = setTimeout(async () => {
            const snapshot = timelineStateRef.current;
            if (!snapshot || snapshot.saveStatus !== "dirty") {
                return;
            }

            setTimelineState((current) =>
                current
                    ? {
                        ...current,
                        saveStatus: "saving",
                        error: null,
                    }
                    : current,
            );

            try {
                const response = await patchTimeline(snapshot.timelineId, {
                    baseVersion: snapshot.baseVersion,
                    source: "autosave",
                    data: snapshot.data,
                });
                const nextState = toEditorTimelineState(response, "saved");
                setTimelineState(nextState);
                persistTimelineCache(nextState);
                setTimelineError(null);
            } catch (caughtError) {
                if (
                    caughtError instanceof ApiClientError &&
                    caughtError.status === 400
                ) {
                    setTimelineState((current) =>
                        current
                            ? {
                                ...current,
                                saveStatus: "conflict",
                                error: "Timeline version conflict. Refresh to sync the latest edits.",
                            }
                            : current,
                    );
                    setTimelineError("Timeline version conflict. Refresh to sync.");
                    return;
                }

                if (
                    caughtError instanceof ApiClientError &&
                    caughtError.status === 401
                ) {
                    setTimelineState((current) =>
                        current
                            ? {
                                ...current,
                                saveStatus: "error",
                                error: "Authentication required to save timeline edits.",
                            }
                            : current,
                    );
                    setTimelineError("Authentication required to save timeline edits.");
                    return;
                }

                setTimelineState((current) =>
                    current
                        ? {
                            ...current,
                            saveStatus: "error",
                            error: "Autosave failed. Try manual Save.",
                        }
                        : current,
                );
                setTimelineError("Autosave failed. Try manual Save.");
            }
        }, 1200);
    }, [persistTimelineCache, toEditorTimelineState]);

    const dispatchCommand = useCallback(
        (command: TEditorCommand) => {
            setTimelineState((current) => {
                if (!current) {
                    return current;
                }

                const nextData = applyEditorCommand(current.data, command);
                if (nextData === current.data) {
                    return current;
                }

                const nextState: EditorTimelineState = {
                    ...current,
                    data: nextData,
                    saveStatus: "dirty",
                    error: null,
                    source: "autosave",
                };
                persistTimelineCache(nextState);
                return nextState;
            });

            queueAutosave();
        },
        [persistTimelineCache, queueAutosave],
    );

    const handleManualSave = useCallback(async () => {
        const snapshot = timelineStateRef.current;
        if (!snapshot) {
            return;
        }

        if (autosaveTimerRef.current) {
            clearTimeout(autosaveTimerRef.current);
            autosaveTimerRef.current = null;
        }

        setTimelineState((current) =>
            current
                ? {
                    ...current,
                    saveStatus: "saving",
                    error: null,
                }
                : current,
        );

        try {
            const response = await createTimelineVersion(snapshot.timelineId, {
                baseVersion: snapshot.baseVersion,
                source: "manual",
                data: snapshot.data,
            });
            const nextState = toEditorTimelineState(response, "saved");
            setTimelineState(nextState);
            persistTimelineCache(nextState);
            setTimelineError(null);
            return true;
        } catch (caughtError) {
            if (
                caughtError instanceof ApiClientError &&
                caughtError.status === 400
            ) {
                setTimelineState((current) =>
                    current
                        ? {
                            ...current,
                            saveStatus: "conflict",
                            error: "Timeline version conflict. Refresh to sync the latest edits.",
                        }
                        : current,
                );
                setTimelineError("Timeline version conflict. Refresh to sync.");
                return false;
            }

            if (
                caughtError instanceof ApiClientError &&
                caughtError.status === 401
            ) {
                setTimelineError("Authentication required to save timeline edits.");
                setTimelineState((current) =>
                    current
                        ? {
                            ...current,
                            saveStatus: "error",
                            error: "Authentication required to save timeline edits.",
                        }
                        : current,
                );
                return false;
            }

            setTimelineError("Manual save failed. Please try again.");
            setTimelineState((current) =>
                current
                    ? {
                        ...current,
                        saveStatus: "error",
                        error: "Manual save failed. Please try again.",
                    }
                    : current,
            );
            return false;
        }
    }, [persistTimelineCache, toEditorTimelineState]);

    useEffect(
        () => () => {
            if (autosaveTimerRef.current) {
                clearTimeout(autosaveTimerRef.current);
            }
        },
        [],
    );

    return {
        timelineState,
        setTimelineState,
        timelineError,
        setTimelineError,
        dispatchCommand,
        handleManualSave,
        toEditorTimelineState,
        persistTimelineCache,
        queueAutosave
    };
}
