import type {
  TCreateProjectRequest,
  TProjectListResponse,
  TProjectResponse,
} from "@doujin/shared/types";
import { SProjectListResponse, SProjectResponse } from "@doujin/shared/types";
import { createDb } from "@doujin/database";
import type { TServiceResult } from "./service-result";
import { createProjectRepo } from "../repos/project-repo";

export type TProjectServiceConfig = {
  env: {
    DB: D1Database;
  };
};

export type TCreateProjectInput = {
  userId: string;
  payload: TCreateProjectRequest;
};

export type TListProjectsInput = {
  userId: string;
};

export interface IProjectService {
  createProject(
    input: TCreateProjectInput,
  ): Promise<TServiceResult<TProjectResponse>>;
  listProjects(
    input: TListProjectsInput,
  ): Promise<TServiceResult<TProjectListResponse>>;
}

export const createProjectService = (
  config: TProjectServiceConfig,
): IProjectService => {
  return {
    async createProject(input) {
      const db = createDb(config.env.DB);
      const repo = createProjectRepo({ db });
      const created = await repo.createProject({
        userId: input.userId,
        title: input.payload.title,
      });

      return {
        ok: true,
        data: SProjectResponse.parse({
          project: {
            id: created.id,
            title: created.title,
            role: created.role,
          },
        }),
      };
    },

    async listProjects(input) {
      const db = createDb(config.env.DB);
      const repo = createProjectRepo({ db });
      const projects = await repo.listProjects({ userId: input.userId });

      return {
        ok: true,
        data: SProjectListResponse.parse({ projects }),
      };
    },
  };
};
