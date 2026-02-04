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
} from "@doujin/shared";

interface MessageRendererProps {
  content: TMessageContent;
}

function UrlSubmittedRenderer({ content }: { content: TUrlSubmitted }) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium text-white/90">URL Submitted</div>
      <div className="text-xs text-white/60">
        <a
          href={content.url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          {content.url}
        </a>
      </div>
      <div className="text-xs text-white/50">
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
      <div className="text-sm text-white/80">{content.message}</div>
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 rounded-full bg-black/30 overflow-hidden">
          <div
            className="h-full bg-[color:var(--accent)]"
            style={{ width: `${content.progress}%` }}
          />
        </div>
        <span className="text-xs text-white/60">
          {content.progress}%
        </span>
      </div>
    </div>
  );
}

function GenerationResultRenderer({ content }: { content: TGenerationResult }) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium text-white/90">Generation Complete</div>
      <div className="text-sm text-white/70">{content.summary}</div>
      {content.artifactRefs.length > 0 && (
        <div className="text-xs text-white/50">
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
      <div className="text-sm font-medium text-white/90">Checkpoint Created</div>
      <div className="text-xs text-white/60">
        Reason: {reasonLabels[content.reason]}
      </div>
      <div className="text-xs text-white/50">
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
      <div className="text-sm font-medium text-white/90">Checkpoint Restored</div>
      <div className="text-xs text-white/60">
        Applied: {content.checkpointId.slice(0, 8)}...
      </div>
      {content.previousCheckpointId && (
        <div className="text-xs text-white/50">
          Previous: {content.previousCheckpointId.slice(0, 8)}...
        </div>
      )}
    </div>
  );
}

function SceneRegeneratedRenderer({ content }: { content: TSceneRegenerated }) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium text-white/90">Scene Regenerated</div>
      <div className="text-sm text-white/70">{content.instruction}</div>
      <div className="text-xs text-white/50">
        Scene: {content.sceneId.slice(0, 8)}...
      </div>
    </div>
  );
}

function RenderRequestedRenderer({ content }: { content: TRenderRequested }) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium text-white/90">Render Requested</div>
      <div className="text-xs text-white/60">
        Format: {content.format}
      </div>
      <div className="text-xs text-white/50">
        Job: {content.renderJobId.slice(0, 8)}...
      </div>
    </div>
  );
}

function RenderProgressRenderer({ content }: { content: TRenderProgress }) {
  return (
    <div className="space-y-1">
      <div className="text-sm text-white/80">Rendering: {content.status}</div>
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 rounded-full bg-black/30 overflow-hidden">
          <div
            className="h-full bg-[color:var(--accent)]"
            style={{ width: `${content.progress}%` }}
          />
        </div>
        <span className="text-xs text-white/60">
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
      <div className="text-sm font-medium text-white/90">
        Render {statusLabels[content.status]}
      </div>
      {content.outputUrl && (
        <a
          href={content.outputUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs underline text-[#d8dd5a]"
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
      <div className="text-xs text-white/50">Unknown message</div>
      );
  }
}
