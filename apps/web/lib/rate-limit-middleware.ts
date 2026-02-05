import { createRateLimitError } from "~/lib/error-helpers";

type TOperation = "generate" | "regenerate_scene" | "generate_assets" | "render";

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const RATE_LIMITS: Record<TOperation, RateLimitConfig> = {
  generate: { windowMs: 60_000, maxRequests: 10 },
  regenerate_scene: { windowMs: 60_000, maxRequests: 20 },
  generate_assets: { windowMs: 60_000, maxRequests: 30 },
  render: { windowMs: 60_000, maxRequests: 5 },
};

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

function getRateLimitKey(userId: string, operation: TOperation): string {
  return `${userId}:${operation}`;
}

function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

export async function checkRateLimit(
  userId: string,
  operation: TOperation,
  correlationId: string,
): Promise<Response | null> {
  cleanupExpiredEntries();

  const key = getRateLimitKey(userId, operation);
  const config = RATE_LIMITS[operation];
  const now = Date.now();

  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    });
    return null;
  }

  if (entry.count >= config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return createRateLimitError(retryAfter, correlationId);
  }

  entry.count++;
  return null;
}
