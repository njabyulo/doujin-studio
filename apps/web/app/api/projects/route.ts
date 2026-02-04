import { desc, eq } from "@doujin/database";
import { db } from "@doujin/database/client";
import { project } from "@doujin/database/schema";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "~/lib/auth-middleware";
import {
  getCorrelationId,
  withCorrelationId,
} from "~/lib/correlation-middleware";
import { createServerError, createValidationError } from "~/lib/error-helpers";

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request);
  console.log(`[${correlationId}] POST /api/projects`);

  const authResult = await requireAuth(request, correlationId);
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const body = await request.json();
    const { title } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      console.log(`[${correlationId}] Validation failed: title is required`);
      return createValidationError(correlationId, {
        title: ["title is required and must be a non-empty string"],
      });
    }

    const [newProject] = await db
      .insert(project)
      .values({
        userId: authResult.user.id,
        title: title.trim(),
      })
      .returning();

    console.log(`[${correlationId}] Project created: ${newProject.id}`);
    return withCorrelationId(
      NextResponse.json(newProject, { status: 201 }),
      correlationId,
    );
  } catch (error) {
    console.error(`[${correlationId}] Error creating project:`, error);
    return createServerError(correlationId);
  }
}

export async function GET(request: NextRequest) {
  const correlationId = getCorrelationId(request);
  console.log(`[${correlationId}] GET /api/projects`);

  const authResult = await requireAuth(request, correlationId);
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const projects = await db
      .select()
      .from(project)
      .where(eq(project.userId, authResult.user.id))
      .orderBy(desc(project.updatedAt));

    console.log(`[${correlationId}] Found ${projects.length} projects`);
    return withCorrelationId(NextResponse.json(projects), correlationId);
  } catch (error) {
    console.error(`[${correlationId}] Error listing projects:`, error);
    return createServerError(correlationId);
  }
}
