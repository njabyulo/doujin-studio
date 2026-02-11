import { createDb, eq, and } from "@doujin/database";
import {
  aiCreditDefaultPolicy,
  aiCreditPolicy,
  aiDailyUsage,
} from "@doujin/database/schema";
import { lt, sql } from "drizzle-orm";

export type TAiCreditsRepoConfig = {
  db: ReturnType<typeof createDb>;
};

export type TAiCreditsConsumeInput = {
  userId: string;
  feature: string;
};

export type TAiCreditsConsumeResult =
  | {
      ok: true;
      headers: Record<string, string>;
    }
  | {
      ok: false;
      status: 429;
      code: "RATE_LIMITED";
      message: string;
      headers: Record<string, string>;
    }
  | {
      ok: false;
      status: 500;
      code: "INTERNAL_ERROR";
      message: string;
      headers?: Record<string, string>;
    };

export interface IAiCreditsRepo {
  consumeDailyCredit(
    input: TAiCreditsConsumeInput,
  ): Promise<TAiCreditsConsumeResult>;
}

export const createAiCreditsRepo = (
  config: TAiCreditsRepoConfig,
): IAiCreditsRepo => {
  return {
    async consumeDailyCredit(input) {
      const dayUtc = new Date().toISOString().slice(0, 10);

      const nextUtcMidnightMs = (() => {
        const now = new Date();
        return Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + 1,
          0,
          0,
          0,
          0,
        );
      })();

      const resetIso = new Date(nextUtcMidnightMs).toISOString();
      const retryAfterSeconds = Math.max(
        0,
        Math.ceil((nextUtcMidnightMs - Date.now()) / 1000),
      );

      const [defaultPolicy] = await config.db
        .select({
          dailyLimit: aiCreditDefaultPolicy.dailyLimit,
          enabled: aiCreditDefaultPolicy.enabled,
        })
        .from(aiCreditDefaultPolicy)
        .where(eq(aiCreditDefaultPolicy.feature, input.feature))
        .limit(1);

      if (!defaultPolicy) {
        return {
          ok: false,
          status: 500,
          code: "INTERNAL_ERROR",
          message: "Missing AI credit policy",
        };
      }

      const [overridePolicy] = await config.db
        .select({
          dailyLimit: aiCreditPolicy.dailyLimit,
          enabled: aiCreditPolicy.enabled,
        })
        .from(aiCreditPolicy)
        .where(
          and(
            eq(aiCreditPolicy.userId, input.userId),
            eq(aiCreditPolicy.feature, input.feature),
          ),
        )
        .limit(1);

      const headerBase: Record<string, string> = {
        "x-ai-credits-reset": resetIso,
      };

      if (overridePolicy && overridePolicy.enabled === false) {
        return {
          ok: false,
          status: 429,
          code: "RATE_LIMITED",
          message: "Daily credits are used up. Try again tomorrow.",
          headers: {
            ...headerBase,
            "Retry-After": retryAfterSeconds.toString(),
            "x-ai-credits-limit": "0",
            "x-ai-credits-remaining": "0",
          },
        };
      }

      const isUnlimited =
        overridePolicy && overridePolicy.dailyLimit === null ? true : false;

      const effectiveLimit =
        overridePolicy && overridePolicy.dailyLimit != null
          ? overridePolicy.dailyLimit
          : defaultPolicy.dailyLimit;

      if (!defaultPolicy.enabled) {
        return {
          ok: false,
          status: 429,
          code: "RATE_LIMITED",
          message: "Daily credits are used up. Try again tomorrow.",
          headers: {
            ...headerBase,
            "Retry-After": retryAfterSeconds.toString(),
            "x-ai-credits-limit": "0",
            "x-ai-credits-remaining": "0",
          },
        };
      }

      if (isUnlimited) {
        return {
          ok: true,
          headers: headerBase,
        };
      }

      await config.db
        .insert(aiDailyUsage)
        .values({
          userId: input.userId,
          dayUtc,
          feature: input.feature,
          used: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoNothing({
          target: [
            aiDailyUsage.userId,
            aiDailyUsage.dayUtc,
            aiDailyUsage.feature,
          ],
        });

      const updated = await config.db
        .update(aiDailyUsage)
        .set({
          used: sql`${aiDailyUsage.used} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(aiDailyUsage.userId, input.userId),
            eq(aiDailyUsage.dayUtc, dayUtc),
            eq(aiDailyUsage.feature, input.feature),
            lt(aiDailyUsage.used, effectiveLimit),
          ),
        )
        .returning({ used: aiDailyUsage.used });

      if (updated.length === 0) {
        return {
          ok: false,
          status: 429,
          code: "RATE_LIMITED",
          message: "Daily credits are used up. Try again tomorrow.",
          headers: {
            ...headerBase,
            "Retry-After": retryAfterSeconds.toString(),
            "x-ai-credits-limit": String(effectiveLimit),
            "x-ai-credits-remaining": "0",
          },
        };
      }

      const usedNow = updated[0]?.used ?? effectiveLimit;
      const remaining = Math.max(0, effectiveLimit - usedNow);

      return {
        ok: true,
        headers: {
          ...headerBase,
          "x-ai-credits-limit": String(effectiveLimit),
          "x-ai-credits-remaining": String(remaining),
        },
      };
    },
  };
};
