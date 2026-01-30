type StreamEvent =
  | { type: "generation_progress"; message: string; progress: number }
  | { type: "generation_partial"; storyboard: unknown }
  | { type: "generation_complete"; checkpointId: string; summary: string }
  | { type: "generation_error"; error: string };

export async function* consumeGenerationStream(
  response: Response,
): AsyncGenerator<StreamEvent> {
  if (!response.body) {
    throw new Error("Response body is null");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data.trim()) {
            try {
              const event = JSON.parse(data) as StreamEvent;
              yield event;
            } catch (e) {
              console.error("Failed to parse SSE data:", data, e);
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
