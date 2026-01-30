"use client";

import type {
  TCheckpointApplied,
  TCheckpointCreated,
  TGenerationProgress,
  TGenerationResult,
  TMessageContent,
  TRenderCompleted,
  TRenderProgress,
  TRenderRequested,
  TSceneRegenerated,
  TUrlSubmitted,
} from "@a-ds/shared";

interface MessageRendererProps {
  content: TMessageContent;
}

function UrlSubmittedRenderer({ content }: { content: TUrlSubmitted }) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium">URL Submitted</div>
      <div className="text-xs text-muted-foreground">
        <a
          href={content.url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          {content.url}
        </a>
      </div>
      <div className="text-xs text-muted-foreground">
        Format: {content.format}
        {content.tone && ` • Tone: ${content.tone}`}
      </div>
    </div>
  );
}

function GenerationProgressRenderer({
  content,
}: {
  content: TGenerationProgress;
}) {
  return (
    <div className="space-y-1">
      <div className="text-sm">{content.message}</div>
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500"
            style={{ width: `${content.progress}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {content.progress}%
        </span>
      </div>
    </div>
  );
}

function GenerationResultRenderer({ content }: { content: TGenerationResult }) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium">Generation Complete</div>
      <div className="text-sm">{content.summary}</div>
      {content.artifactRefs.length > 0 && (
        <div className="text-xs text-muted-foreground">
          Checkpoint: {content.checkpointId.slice(0, 8)}...
        </div>
      )}
    </div>
  );
}

function CheckpointCreatedRenderer({
  content,
}: {
  content: TCheckpointCreated;
}) {
  const reasonLabels = {
    generation: "Generated",
    manual_edit: "Manual Edit",
    scene_regeneration: "Scene Regenerated",
    brand_kit_update: "Brand Kit Updated",
  };

  return (
    <div className="space-y-1">
      <div className="text-sm font-medium">Checkpoint Created</div>
      <div className="text-xs text-muted-foreground">
        Reason: {reasonLabels[content.reason]}
      </div>
      <div className="text-xs text-muted-foreground">
        ID: {content.checkpointId.slice(0, 8)}...
      </div>
    </div>
  );
}

function CheckpointAppliedRenderer({
  content,
}: {
  content: TCheckpointApplied;
}) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium">Checkpoint Restored</div>
      <div className="text-xs text-muted-foreground">
        Applied: {content.checkpointId.slice(0, 8)}...
      </div>
      {content.previousCheckpointId && (
        <div className="text-xs text-muted-foreground">
          Previous: {content.previousCheckpointId.slice(0, 8)}...
        </div>
      )}
    </div>
  );
}

function SceneRegeneratedRenderer({ content }: { content: TSceneRegenerated }) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium">Scene Regenerated</div>
      <div className="text-sm">{content.instruction}</div>
      <div className="text-xs text-muted-foreground">
        Scene: {content.sceneId.slice(0, 8)}...
      </div>
    </div>
  );
}

function RenderRequestedRenderer({ content }: { content: TRenderRequested }) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium">Render Requested</div>
      <div className="text-xs text-muted-foreground">
        Format: {content.format}
      </div>
      <div className="text-xs text-muted-foreground">
        Job: {content.renderJobId.slice(0, 8)}...
      </div>
    </div>
  );
}

function RenderProgressRenderer({ content }: { content: TRenderProgress }) {
  return (
    <div className="space-y-1">
      <div className="text-sm">Rendering: {content.status}</div>
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500"
            style={{ width: `${content.progress}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {content.progress}%
        </span>
      </div>
    </div>
  );
}

function RenderCompletedRenderer({ content }: { content: TRenderCompleted }) {
  const statusLabels = {
    completed: "Completed",
    failed: "Failed",
    cancelled: "Cancelled",
  };

  const statusColors = {
    completed: "text-green-500",
    failed: "text-red-500",
    cancelled: "text-gray-500",
  };

  return (
    <div className="space-y-1">
      <div className="text-sm font-medium">
        Render {statusLabels[content.status]}
      </div>
      {content.outputUrl && (
        <a
          href={content.outputUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs underline text-blue-500"
        >
          Download Video
        </a>
      )}
      <div className={`text-xs ${statusColors[content.status]}`}>
        {statusLabels[content.status]}
      </div>
    </div>
  );
}

export function MessageRenderer({ content }: MessageRendererProps) {
  switch (content.type) {
    case "url_submitted":
      return <UrlSubmittedRenderer content={content} />;
    case "generation_progress":
      return <GenerationProgressRenderer content={content} />;
    case "generation_result":
      return <GenerationResultRenderer content={content} />;
    case "checkpoint_created":
      return <CheckpointCreatedRenderer content={content} />;
    case "checkpoint_applied":
      return <CheckpointAppliedRenderer content={content} />;
    case "scene_regenerated":
      return <SceneRegeneratedRenderer content={content} />;
    case "render_requested":
      return <RenderRequestedRenderer content={content} />;
    case "render_progress":
      return <RenderProgressRenderer content={content} />;
    case "render_completed":
      return <RenderCompletedRenderer content={content} />;
    default:
      return (
        <div className="text-xs text-muted-foreground">Unknown message</div>
      );
  }
}
