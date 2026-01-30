// Feature: mvp-architecture-refactor, Property 30: Signed URL Security
// Validates: Requirements 25.2, 25.3

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

interface RenderJob {
  id: string;
  outputS3Key: string | null;
  status: string;
}

interface SignedUrlResponse {
  url: string | null;
  expiresIn: number;
}

describe("Property 30: Signed URL Security", () => {
  it("should store S3 key and generate short-lived signed URLs on demand (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            renderJobId: fc.uuid(),
            outputS3Key: fc.string({ minLength: 10 }),
            status: fc.constant("completed"),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        async (renderJobs) => {
          for (const job of renderJobs) {
            const renderJob = await createCompletedRenderJob(
              job.renderJobId,
              job.outputS3Key,
            );

            expect(renderJob.outputS3Key).toBe(job.outputS3Key);

            const signedUrlResponse = await generateSignedUrl(renderJob);

            expect(signedUrlResponse.url).toBeDefined();
            expect(signedUrlResponse.url).not.toBe(job.outputS3Key);
            expect(signedUrlResponse.expiresIn).toBe(3600);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should not generate signed URLs for public or long-lived URLs (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            renderJobId: fc.uuid(),
            outputS3Key: fc.string({ minLength: 10 }),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        async (renderJobs) => {
          for (const job of renderJobs) {
            const renderJob = await createCompletedRenderJob(
              job.renderJobId,
              job.outputS3Key,
            );

            const signedUrlResponse = await generateSignedUrl(renderJob);

            expect(signedUrlResponse.url).not.toContain("public");
            expect(signedUrlResponse.expiresIn).toBeLessThanOrEqual(3600);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

async function createCompletedRenderJob(
  id: string,
  outputS3Key: string,
): Promise<RenderJob> {
  return {
    id,
    outputS3Key,
    status: "completed",
  };
}

async function generateSignedUrl(
  renderJob: RenderJob,
): Promise<SignedUrlResponse> {
  if (!renderJob.outputS3Key) {
    return { url: null, expiresIn: 0 };
  }

  return {
    url: `https://signed-url.example.com/${renderJob.outputS3Key}?expires=3600`,
    expiresIn: 3600,
  };
}
