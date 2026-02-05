import { eq } from "@doujin/database";
import { db } from "@doujin/database/client";
import { project } from "@doujin/database/schema";
import { z } from "zod";
import { requireAuth } from "~/lib/auth-middleware";
import {
  getCorrelationId,
  withCorrelationId,
} from "~/lib/correlation-middleware";
import {
  createForbiddenError,
  createNotFoundError,
  createServerError,
  createValidationError,
} from "~/lib/error-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

const SProxyQuery = z.object({
  uri: z.string().url(),
});

const ALLOWED_HOST_SUFFIXES = [
  "generativelanguage.googleapis.com",
  "storage.googleapis.com",
  "googleusercontent.com",
];

function isAllowedHost(hostname: string) {
  return ALLOWED_HOST_SUFFIXES.some(
    (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = getCorrelationId(request);
  const { id: projectId } = await params;
  console.log(
    `[${correlationId}] GET /api/projects/${projectId}/assets/video-proxy`,
  );

  const authResult = await requireAuth(request, correlationId);
  if (authResult.error) return authResult.error;

  try {
    const url = new URL(request.url);
    const uri = url.searchParams.get("uri");
    const parsed = SProxyQuery.safeParse({ uri });
    if (!parsed.success) {
      return createValidationError(correlationId, {
        uri: ["A valid uri query parameter is required."],
      });
    }

    const targetUrl = new URL(parsed.data.uri);
    if (!isAllowedHost(targetUrl.hostname)) {
      return createValidationError(correlationId, {
        uri: ["Unsupported video host."],
      });
    }

    const [existingProject] = await db
      .select()
      .from(project)
      .where(eq(project.id, projectId))
      .limit(1);

    if (!existingProject) {
      return createNotFoundError("Project", correlationId);
    }

    if (existingProject.userId !== authResult.user.id) {
      return createForbiddenError(correlationId);
    }

    const apiKey =
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GOOGLE_GENERATIVE_AI_API_KEY");
    }

    const response = await fetch(parsed.data.uri, {
      headers: {
        "x-goog-api-key": apiKey,
      },
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || "Failed to fetch generated video");
    }

    if (!response.body) {
      throw new Error("Video stream unavailable");
    }

    const contentType =
      response.headers.get("content-type") ?? "video/mp4";

    return withCorrelationId(
      new Response(response.body, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "no-store",
        },
      }),
      correlationId,
    );
  } catch (error) {
    console.error(`[${correlationId}] Video proxy error:`, error);
    return createServerError(correlationId);
  }
}
