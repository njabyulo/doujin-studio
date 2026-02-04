import { db } from "@doujin/database/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { storeIdempotencyKey } from "~/lib/idempotency-helpers";

vi.mock("@doujin/database/client", () => ({
  db: {
    insert: vi.fn(),
  },
}));

describe("storeIdempotencyKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should insert idempotency key successfully", async () => {
    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db.insert as any) = mockInsert;

    await storeIdempotencyKey(
      "test-key",
      "project-123",
      "user-456",
      "generate",
      "message-789",
    );

    expect(mockInsert).toHaveBeenCalled();
  });

  it("should handle unique constraint violations gracefully", async () => {
    const uniqueError = new Error(
      "duplicate key value violates unique constraint",
    );
    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockRejectedValue(uniqueError),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db.insert as any) = mockInsert;

    await expect(
      storeIdempotencyKey(
        "test-key",
        "project-123",
        "user-456",
        "generate",
        "message-789",
      ),
    ).resolves.toBeUndefined();
  });

  it("should re-throw non-constraint errors", async () => {
    const otherError = new Error("Database connection failed");
    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockRejectedValue(otherError),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db.insert as any) = mockInsert;

    await expect(
      storeIdempotencyKey(
        "test-key",
        "project-123",
        "user-456",
        "generate",
        "message-789",
      ),
    ).rejects.toThrow("Database connection failed");
  });
});
