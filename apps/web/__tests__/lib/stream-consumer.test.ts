import { describe, expect, it } from "vitest";
import { consumeGenerationStream } from "~/lib/stream-consumer";

function createSSEResponse(events: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${event}\n\n`));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("consumeGenerationStream", () => {
  it("should parse generation_progress events", async () => {
    const response = createSSEResponse([
      JSON.stringify({
        type: "generation_progress",
        message: "Extracting page content",
        progress: 10,
      }),
      JSON.stringify({
        type: "generation_progress",
        message: "Generating storyboard",
        progress: 50,
      }),
    ]);

    const events = [];
    for await (const event of consumeGenerationStream(response)) {
      events.push(event);
    }

    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({
      type: "generation_progress",
      message: "Extracting page content",
      progress: 10,
    });
    expect(events[1]).toEqual({
      type: "generation_progress",
      message: "Generating storyboard",
      progress: 50,
    });
  });

  it("should parse generation_partial events", async () => {
    const response = createSSEResponse([
      JSON.stringify({
        type: "generation_partial",
        storyboard: {
          adTitle: "Test Ad",
          scenes: [{ textOverlay: "Scene 1" }],
        },
      }),
    ]);

    const events = [];
    for await (const event of consumeGenerationStream(response)) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: "generation_partial",
      storyboard: {
        adTitle: "Test Ad",
        scenes: [{ textOverlay: "Scene 1" }],
      },
    });
  });

  it("should parse generation_complete events", async () => {
    const response = createSSEResponse([
      JSON.stringify({
        type: "generation_complete",
        checkpointId: "123e4567-e89b-12d3-a456-426614174000",
        summary: "3 scenes, 15s",
      }),
    ]);

    const events = [];
    for await (const event of consumeGenerationStream(response)) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: "generation_complete",
      checkpointId: "123e4567-e89b-12d3-a456-426614174000",
      summary: "3 scenes, 15s",
    });
  });

  it("should parse generation_error events", async () => {
    const response = createSSEResponse([
      JSON.stringify({
        type: "generation_error",
        error: "Failed to extract content",
      }),
    ]);

    const events = [];
    for await (const event of consumeGenerationStream(response)) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: "generation_error",
      error: "Failed to extract content",
    });
  });

  it("should handle multiple event types in sequence", async () => {
    const response = createSSEResponse([
      JSON.stringify({
        type: "generation_progress",
        message: "Starting",
        progress: 0,
      }),
      JSON.stringify({
        type: "generation_partial",
        storyboard: { adTitle: "Test" },
      }),
      JSON.stringify({
        type: "generation_progress",
        message: "Finishing",
        progress: 90,
      }),
      JSON.stringify({
        type: "generation_complete",
        checkpointId: "123e4567-e89b-12d3-a456-426614174000",
        summary: "Done",
      }),
    ]);

    const events = [];
    for await (const event of consumeGenerationStream(response)) {
      events.push(event);
    }

    expect(events).toHaveLength(4);
    expect(events[0].type).toBe("generation_progress");
    expect(events[1].type).toBe("generation_partial");
    expect(events[2].type).toBe("generation_progress");
    expect(events[3].type).toBe("generation_complete");
  });

  it("should handle empty stream", async () => {
    const response = createSSEResponse([]);

    const events = [];
    for await (const event of consumeGenerationStream(response)) {
      events.push(event);
    }

    expect(events).toHaveLength(0);
  });

  it("should skip invalid JSON lines", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode("data: invalid json\n\n"));
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "generation_progress", message: "Valid", progress: 10 })}\n\n`,
          ),
        );
        controller.close();
      },
    });

    const response = new Response(stream, {
      headers: { "Content-Type": "text/event-stream" },
    });

    const events = [];
    for await (const event of consumeGenerationStream(response)) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("generation_progress");
  });
});
