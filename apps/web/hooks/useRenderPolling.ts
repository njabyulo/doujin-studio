import { useEffect, useRef, useState } from "react";

type RenderStatus =
  | "pending"
  | "rendering"
  | "completed"
  | "failed"
  | "cancel_requested"
  | "cancelled";

interface RenderJobProgress {
  status: RenderStatus;
  progress: number;
  outputUrl?: string | null;
}

interface UseRenderPollingOptions {
  renderJobId: string;
  onUpdate?: (data: RenderJobProgress) => void;
}

export function useRenderPolling({
  renderJobId,
  onUpdate,
}: UseRenderPollingOptions) {
  const [data, setData] = useState<RenderJobProgress | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!renderJobId) return;

    startTimeRef.current = Date.now();

    const poll = async () => {
      try {
        const response = await fetch(`/api/render/${renderJobId}/status`);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        setData(result);
        onUpdate?.(result);

        const isTerminal =
          result.status === "completed" ||
          result.status === "failed" ||
          result.status === "cancelled";

        if (!isTerminal) {
          const elapsed = Date.now() - startTimeRef.current;
          const interval = elapsed > 60000 ? 10000 : 3000;
          timeoutRef.current = setTimeout(poll, interval);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
      }
    };

    poll();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [renderJobId, onUpdate]);

  return { data, error };
}
