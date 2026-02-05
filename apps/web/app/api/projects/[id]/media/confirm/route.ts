import { eq } from "@doujin/database";
import { db } from "@doujin/database/client";
import { project } from "@doujin/database/schema";
import { SMediaPlan } from "@doujin/shared";
import { Resource } from "sst";
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

const SConfirmInput = z.object({
  promptId: z.string().uuid(),
  assetType: z.enum(["image", "video"]),
  s3Key: z.string().min(1),
  mimeType: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = getCorrelationId(request);
  const { id: projectId } = await params;
  console.log(`[${correlationId}] POST /api/projects/${projectId}/media/confirm`);

  const authResult = await requireAuth(request, correlationId);
  if (authResult.error) return authResult.error;

  try {
    const body = await request.json();
    const input = SConfirmInput.parse(body);

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

    const parsedPlan = SMediaPlan.safeParse(existingProject.mediaPlanJson);
    if (!parsedPlan.success) {
      return createValidationError(correlationId, {
        mediaPlan: ["Media plan is missing or invalid."],
      });
    }

    const mediaPlan = parsedPlan.data;
    const listKey = input.assetType === "video" ? "videos" : "images";
    const prompts = mediaPlan.prompts[listKey];
    const promptIndex = prompts.findIndex((prompt) => prompt.id === input.promptId);

    if (promptIndex === -1) {
      return createNotFoundError("Prompt", correlationId);
    }

    const region = process.env.AWS_REGION || "us-east-1";
    const publicUrl = `https://${Resource.VideoBucket.name}.s3.${region}.amazonaws.com/${input.s3Key}`;

    const updatedPrompt = {
      ...prompts[promptIndex],
      asset: {
        ...(prompts[promptIndex].asset ?? {}),
        url: publicUrl,
        mimeType: input.mimeType ?? prompts[promptIndex].asset?.mimeType,
      },
    };

    const updatedPrompts = [...prompts];
    updatedPrompts[promptIndex] = updatedPrompt;

    const updatedPlan = {
      ...mediaPlan,
      prompts: {
        ...mediaPlan.prompts,
        [listKey]: updatedPrompts,
      },
    };

    await db
      .update(project)
      .set({ mediaPlanJson: updatedPlan, updatedAt: new Date() })
      .where(eq(project.id, projectId));

    return withCorrelationId(
      Response.json({
        promptId: input.promptId,
        assetUrl: publicUrl,
      }),
      correlationId,
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.log(`[${correlationId}] Validation error:`, error.issues);
      return createValidationError(
        correlationId,
        error.issues.reduce(
          (acc, issue) => ({
            ...acc,
            [issue.path.join(".")]: [issue.message],
          }),
          {},
        ),
      );
    }

    console.error(`[${correlationId}] Media confirm error:`, error);
    return createServerError(correlationId);
  }
}
