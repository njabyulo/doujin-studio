import { and, eq } from "@doujin/database";
import { db } from "@doujin/database/client";
import {
  checkpoint,
  idempotencyKey,
  message,
  renderJob,
} from "@doujin/database/schema";

type TOperation = "generate" | "regenerate_scene" | "generate_assets" | "render";

interface CheckIdempotencyResult {
  existing: unknown | null;
}

export async function checkIdempotency(
  key: string,
  userId: string,
  operation: TOperation,
): Promise<CheckIdempotencyResult> {
  const [existing] = await db
    .select()
    .from(idempotencyKey)
    .where(
      and(
        eq(idempotencyKey.userId, userId),
        eq(idempotencyKey.operation, operation),
        eq(idempotencyKey.key, key),
      ),
    )
    .limit(1);

  if (!existing) {
    return { existing: null };
  }

  if (operation === "render") {
    const [job] = await db
      .select()
      .from(renderJob)
      .where(eq(renderJob.id, existing.resultRef))
      .limit(1);

    return { existing: job ?? null };
  }

  if (operation === "generate" || operation === "generate_assets") {
    const [cp] = await db
      .select()
      .from(checkpoint)
      .where(eq(checkpoint.id, existing.resultRef))
      .limit(1);

    return { existing: cp ?? null };
  }

  const [msg] = await db
    .select()
    .from(message)
    .where(eq(message.id, existing.resultRef))
    .limit(1);

  return { existing: msg ?? null };
}

export async function storeIdempotencyKey(
  key: string,
  projectId: string,
  userId: string,
  operation: TOperation,
  resultRef: string,
): Promise<void> {
  try {
    await db.insert(idempotencyKey).values({
      userId,
      projectId,
      operation,
      key,
      resultRef,
    });
  } catch (error) {
    // Gracefully handle unique constraint violations
    // This can happen if two concurrent requests with the same idempotency key
    // both pass the check and try to insert simultaneously
    if (
      error instanceof Error &&
      (error.message.includes("unique constraint") ||
        error.message.includes("duplicate key"))
    ) {
      // Silently ignore - the first request won the race
      return;
    }
    // Re-throw other errors
    throw error;
  }
}
