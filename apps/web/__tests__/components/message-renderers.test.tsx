import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MessageRenderer } from "~/components/domain/message-renderers";

describe("MessageRenderer", () => {
  it("should render url_submitted message", () => {
    const content = {
      type: "url_submitted" as const,
      version: "1",
      url: "https://example.com/product",
      format: "1:1" as const,
      tone: "professional",
      artifactRefs: [],
    };

    render(<MessageRenderer content={content} />);

    expect(screen.getByText("URL Submitted")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/product")).toBeInTheDocument();
    expect(screen.getByText(/Format: 1:1/)).toBeInTheDocument();
    expect(screen.getByText(/Tone: professional/)).toBeInTheDocument();
  });

  it("should render generation_progress message", () => {
    const content = {
      type: "generation_progress" as const,
      version: "1",
      message: "Extracting content",
      progress: 45,
      artifactRefs: [],
    };

    render(<MessageRenderer content={content} />);

    expect(screen.getByText("Extracting content")).toBeInTheDocument();
    expect(screen.getByText("45%")).toBeInTheDocument();
  });

  it("should render generation_result message", () => {
    const content = {
      type: "generation_result" as const,
      version: "1",
      checkpointId: "12345678-1234-1234-1234-123456789012",
      summary: "3 scenes, 15s",
      artifactRefs: [
        {
          type: "checkpoint" as const,
          id: "12345678-1234-1234-1234-123456789012",
        },
      ],
    };

    render(<MessageRenderer content={content} />);

    expect(screen.getByText("Generation Complete")).toBeInTheDocument();
    expect(screen.getByText("3 scenes, 15s")).toBeInTheDocument();
    expect(screen.getByText(/Checkpoint: 12345678/)).toBeInTheDocument();
  });

  it("should render checkpoint_created message", () => {
    const content = {
      type: "checkpoint_created" as const,
      version: "1",
      checkpointId: "12345678-1234-1234-1234-123456789012",
      reason: "manual_edit" as const,
      artifactRefs: [],
    };

    render(<MessageRenderer content={content} />);

    expect(screen.getByText("Checkpoint Created")).toBeInTheDocument();
    expect(screen.getByText(/Reason: Manual Edit/)).toBeInTheDocument();
  });

  it("should render checkpoint_applied message", () => {
    const content = {
      type: "checkpoint_applied" as const,
      version: "1",
      checkpointId: "12345678-1234-1234-1234-123456789012",
      previousCheckpointId: "87654321-4321-4321-4321-210987654321",
      artifactRefs: [],
    };

    render(<MessageRenderer content={content} />);

    expect(screen.getByText("Checkpoint Restored")).toBeInTheDocument();
    expect(screen.getByText(/Applied: 12345678/)).toBeInTheDocument();
    expect(screen.getByText(/Previous: 87654321/)).toBeInTheDocument();
  });

  it("should render scene_regenerated message", () => {
    const content = {
      type: "scene_regenerated" as const,
      version: "1",
      checkpointId: "12345678-1234-1234-1234-123456789012",
      sceneId: "scene-123-1234-1234-1234-123456789012",
      instruction: "Make it more exciting",
      artifactRefs: [],
    };

    render(<MessageRenderer content={content} />);

    expect(screen.getByText("Scene Regenerated")).toBeInTheDocument();
    expect(screen.getByText("Make it more exciting")).toBeInTheDocument();
  });

  it("should render render_requested message", () => {
    const content = {
      type: "render_requested" as const,
      version: "1",
      renderJobId: "job-1234-1234-1234-1234-123456789012",
      format: "16:9" as const,
      artifactRefs: [],
    };

    render(<MessageRenderer content={content} />);

    expect(screen.getByText("Render Requested")).toBeInTheDocument();
    expect(screen.getByText(/Format: 16:9/)).toBeInTheDocument();
  });

  it("should render render_progress message", () => {
    const content = {
      type: "render_progress" as const,
      version: "1",
      renderJobId: "job-1234-1234-1234-1234-123456789012",
      progress: 75,
      status: "rendering",
      artifactRefs: [],
    };

    render(<MessageRenderer content={content} />);

    expect(screen.getByText(/Rendering: rendering/)).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("should render render_completed message with success", () => {
    const content = {
      type: "render_completed" as const,
      version: "1",
      renderJobId: "job-1234-1234-1234-1234-123456789012",
      outputUrl: "https://example.com/video.mp4",
      status: "completed" as const,
      artifactRefs: [],
    };

    render(<MessageRenderer content={content} />);

    expect(screen.getByText("Render Completed")).toBeInTheDocument();
    expect(screen.getByText("Download Video")).toBeInTheDocument();
  });

  it("should render render_completed message with failure", () => {
    const content = {
      type: "render_completed" as const,
      version: "1",
      renderJobId: "job-1234-1234-1234-1234-123456789012",
      outputUrl: null,
      status: "failed" as const,
      artifactRefs: [],
    };

    render(<MessageRenderer content={content} />);

    expect(screen.getByText("Render Failed")).toBeInTheDocument();
  });

  it("should render render_completed message with cancellation", () => {
    const content = {
      type: "render_completed" as const,
      version: "1",
      renderJobId: "job-1234-1234-1234-1234-123456789012",
      outputUrl: null,
      status: "cancelled" as const,
      artifactRefs: [],
    };

    render(<MessageRenderer content={content} />);

    expect(screen.getByText("Render Cancelled")).toBeInTheDocument();
  });
});
