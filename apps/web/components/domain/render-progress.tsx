"use client";

import { Button } from "~/components/ui/button";

type RenderStatus =
  | "pending"
  | "rendering"
  | "completed"
  | "failed"
  | "cancel_requested"
  | "cancelled";

interface RenderProgressProps {
  renderJobId: string;
  status: RenderStatus;
  progress: number;
  outputUrl?: string | null;
  onCancel: () => void;
  onDownload: () => void;
}

const STATUS_LABELS: Record<RenderStatus, string> = {
  pending: "Pending",
  rendering: "Rendering",
  completed: "Completed",
  failed: "Failed",
  cancel_requested: "Cancelling",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<RenderStatus, string> = {
  pending: "text-yellow-500",
  rendering: "text-blue-500",
  completed: "text-green-500",
  failed: "text-red-500",
  cancel_requested: "text-orange-500",
  cancelled: "text-gray-500",
};

export function RenderProgress({
  renderJobId,
  status,
  progress,
  outputUrl,
  onCancel,
  onDownload,
}: RenderProgressProps) {
  const canCancel =
    status === "pending" ||
    status === "rendering" ||
    status === "cancel_requested";
  const canDownload = status === "completed" && outputUrl;

  return (
    <div className="glassPanel space-y-4 p-4 text-white/90">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-white/70">
          Render Progress
        </h3>
        <span className={`text-xs font-medium ${STATUS_COLORS[status]}`}>
          {STATUS_LABELS[status]}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-white/60">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-black/30 overflow-hidden">
          <div
            className="h-full bg-[color:var(--ds-accent)] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex gap-2">
        {canDownload && (
          <Button onClick={onDownload} className="flex-1 rounded-full" variant="accent">
            Download Video
          </Button>
        )}
        {canCancel && (
          <Button
            onClick={onCancel}
            variant="glass"
            className="flex-1 rounded-full"
            disabled={status === "cancel_requested"}
          >
            {status === "cancel_requested" ? "Cancelling..." : "Cancel Render"}
          </Button>
        )}
        {status === "failed" && (
          <Button variant="glass" className="flex-1 rounded-full" disabled>
            Render Failed
          </Button>
        )}
      </div>

      <div className="text-xs text-white/40">Job ID: {renderJobId}</div>
    </div>
  );
}
