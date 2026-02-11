import { z } from "zod";

export const SProjectRole = z.enum(["owner"]);

export const SCreateProjectRequest = z.object({
  title: z.string().trim().min(1).max(120),
});

export const SProject = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  role: SProjectRole,
});

export const SProjectListResponse = z.object({
  projects: z.array(SProject),
});

export const SProjectResponse = z.object({
  project: SProject,
});

export type TProjectRole = z.infer<typeof SProjectRole>;
export type TCreateProjectRequest = z.infer<typeof SCreateProjectRequest>;
export type TProject = z.infer<typeof SProject>;
export type TProjectListResponse = z.infer<typeof SProjectListResponse>;
export type TProjectResponse = z.infer<typeof SProjectResponse>;
