import { ProjectPage } from "~/features/projects/project-page";

interface ProjectRouteProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectRoute({ params }: ProjectRouteProps) {
  const { id } = await params;
  return <ProjectPage key={id} />;
}
