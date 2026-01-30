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
  const isTerminal =
    status === "completed" ||
    status === "failed" ||
    status === "cancelled" ||
    status === "cancel_requested";
  const canCancel =
    status === "pending" ||
    status === "rendering" ||
    status === "cancel_requested";
  const canDownload = status === "completed" && outputUrl;

  return (
    <div className="p-4 border rounded-lg space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Render Progress</h3>
        <span className={`text-sm font-medium ${STATUS_COLORS[status]}`}>
          {STATUS_LABELS[status]}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex gap-2">
        {canDownload && (
          <Button onClick={onDownload} className="flex-1">
            Download Video
          </Button>
        )}
        {canCancel && (
          <Button
            onClick={onCancel}
            variant="outline"
            className="flex-1"
            disabled={status === "cancel_requested"}
          >
            {status === "cancel_requested" ? "Cancelling..." : "Cancel Render"}
          </Button>
        )}
        {status === "failed" && (
          <Button variant="outline" className="flex-1" disabled>
            Render Failed
          </Button>
        )}
      </div>

      <div className="text-xs text-muted-foreground">Job ID: {renderJobId}</div>
    </div>
  );
}
