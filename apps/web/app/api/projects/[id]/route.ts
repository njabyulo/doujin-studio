import { asc, eq } from "@a-ds/database";
import { db } from "@a-ds/database/client";
import { checkpoint, message, project } from "@a-ds/database/schema";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "~/lib/auth-middleware";
import {
  getCorrelationId,
  withCorrelationId,
} from "~/lib/correlation-middleware";
import {
  createForbiddenError,
  createNotFoundError,
  createServerError,
} from "~/lib/error-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = getCorrelationId(request);
  const { id } = await params;
  console.log(`[${correlationId}] GET /api/projects/${id}`);

  const authResult = await requireAuth(request, correlationId);
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const [projectData] = await db
      .select()
      .from(project)
      .where(eq(project.id, id))
      .limit(1);

    if (!projectData) {
      console.log(`[${correlationId}] Project not found`);
      return createNotFoundError("Project", correlationId);
    }

    if (projectData.userId !== authResult.user.id) {
      console.log(`[${correlationId}] Forbidden: user does not own project`);
      return createForbiddenError(correlationId);
    }

    const messages = await db
      .select()
      .from(message)
      .where(eq(message.projectId, id))
      .orderBy(asc(message.createdAt));

    const checkpoints = await db
      .select()
      .from(checkpoint)
      .where(eq(checkpoint.projectId, id))
      .orderBy(asc(checkpoint.createdAt));

    console.log(
      `[${correlationId}] Found ${messages.length} messages, ${checkpoints.length} checkpoints`,
    );
    return withCorrelationId(
      NextResponse.json({
        project: projectData,
        messages,
        checkpoints,
      }),
      correlationId,
    );
  } catch (error) {
    console.error(`[${correlationId}] Error fetching project:`, error);
    return createServerError(correlationId);
  }
}
