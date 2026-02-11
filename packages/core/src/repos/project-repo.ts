import { createDb, desc, eq } from "@doujin/database";
import { project, projectMember } from "@doujin/database/schema";

export type TProjectRepoConfig = {
  db: ReturnType<typeof createDb>;
};

export type TProjectListItem = {
  id: string;
  title: string;
  role: "owner";
};

export interface IProjectRepo {
  createProject(input: {
    userId: string;
    title: string;
  }): Promise<TProjectListItem>;
  listProjects(input: { userId: string }): Promise<TProjectListItem[]>;
}

export const createProjectRepo = (config: TProjectRepoConfig): IProjectRepo => {
  return {
    async createProject(input) {
      const projectId = crypto.randomUUID();

      await config.db.batch([
        config.db.insert(project).values({
          id: projectId,
          userId: input.userId,
          title: input.title,
        }),
        config.db.insert(projectMember).values({
          projectId,
          userId: input.userId,
          role: "owner",
        }),
      ]);

      return {
        id: projectId,
        title: input.title,
        role: "owner",
      };
    },

    async listProjects(input) {
      return config.db
        .select({
          id: project.id,
          title: project.title,
          role: projectMember.role,
        })
        .from(projectMember)
        .innerJoin(project, eq(projectMember.projectId, project.id))
        .where(eq(projectMember.userId, input.userId))
        .orderBy(desc(project.updatedAt));
    },
  };
};
