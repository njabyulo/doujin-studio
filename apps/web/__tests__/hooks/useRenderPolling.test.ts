import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRenderPolling } from "~/hooks/useRenderPolling";

describe("useRenderPolling", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should make initial poll immediately", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "rendering", progress: 50 }),
    });
    global.fetch = mockFetch;

    const { unmount } = renderHook(() =>
      useRenderPolling({ renderJobId: "job-1", onUpdate: vi.fn() }),
    );

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    expect(mockFetch).toHaveBeenCalledWith("/api/render/job-1/status");

    unmount();
  });

  it("should call onUpdate callback with status data", async () => {
    const onUpdate = vi.fn();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "rendering", progress: 75 }),
    });
    global.fetch = mockFetch;

    const { unmount } = renderHook(() =>
      useRenderPolling({ renderJobId: "job-1", onUpdate }),
    );

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith({
        status: "rendering",
        progress: 75,
      }),
    );

    unmount();
  });

  it("should return completed status and outputUrl", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "completed",
        progress: 100,
        outputUrl: "https://example.com/video.mp4",
      }),
    });
    global.fetch = mockFetch;

    const { result, unmount } = renderHook(() =>
      useRenderPolling({ renderJobId: "job-1", onUpdate: vi.fn() }),
    );

    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(result.current.data?.status).toBe("completed");
    expect(result.current.data?.outputUrl).toBe(
      "https://example.com/video.mp4",
    );

    unmount();
  });

  it("should set error state when fetch fails", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });
    global.fetch = mockFetch;

    const { result, unmount } = renderHook(() =>
      useRenderPolling({ renderJobId: "job-1", onUpdate: vi.fn() }),
    );

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toContain("HTTP 500");

    unmount();
  });

  it("should not poll when renderJobId is empty", async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    const { unmount } = renderHook(() =>
      useRenderPolling({ renderJobId: "", onUpdate: vi.fn() }),
    );

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(mockFetch).not.toHaveBeenCalled();

    unmount();
  });
});
