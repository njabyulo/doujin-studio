import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyEditorCommand,
  createDefaultTimelineData,
  loadEditorTimelineCache,
  saveEditorTimelineCache,
  type TEditorCommand,
  type EditorTimelineState,
} from "~/lib/timeline-state";

export const useTimelineState = (projectId?: string) => {
  const timelineStateRef = useRef<EditorTimelineState | null>(null);

  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [timelineState, setTimelineState] =
    useState<EditorTimelineState | null>(() => {
      if (!projectId) return null;
      const cached = loadEditorTimelineCache(projectId);
      const initialData = cached?.data ?? createDefaultTimelineData();

      return {
        timelineId: cached?.timelineId ?? `local-${projectId}`,
        baseVersion: cached?.baseVersion ?? 1,
        data: initialData,
        saveStatus: "saved",
        lastSavedAt: Date.now(),
        source: "system",
        error: null,
      };
    });

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
    // Local-first: no autosave network calls.
  }, []);

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
          saveStatus: "saved",
          lastSavedAt: Date.now(),
          error: null,
          source: "manual",
        };
        persistTimelineCache(nextState);
        return nextState;
      });

      setTimelineError(null);
    },
    [persistTimelineCache],
  );

  const handleManualSave = useCallback(async () => {
    setTimelineError(null);
    setTimelineState((current) =>
      current
        ? {
            ...current,
            saveStatus: "saved",
            lastSavedAt: Date.now(),
            error: null,
          }
        : current,
    );
    return true;
  }, []);

  return {
    timelineState,
    setTimelineState,
    timelineError,
    setTimelineError,
    dispatchCommand,
    handleManualSave,
    persistTimelineCache,
    queueAutosave,
  };
};
