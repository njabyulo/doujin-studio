import { and, createDb, eq } from "@doujin/database";
import { projectMember } from "@doujin/database/schema";
import { ApiError } from "../errors";

type Database = ReturnType<typeof createDb>;

export async function requireProjectMembership(
  db: Database,
  projectId: string,
  userId: string,
) {
  const [membership] = await db
    .select({
      projectId: projectMember.projectId,
      role: projectMember.role,
    })
    .from(projectMember)
    .where(
      and(
        eq(projectMember.projectId, projectId),
        eq(projectMember.userId, userId),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new ApiError(404, "NOT_FOUND", "Project not found");
  }

  return membership;
}
