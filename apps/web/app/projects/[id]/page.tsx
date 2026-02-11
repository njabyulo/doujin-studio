import { ProjectPage } from "~/features/projects/project-page";

interface ProjectRouteProps {
  params: Promise<{ id: string }>;
}

const ProjectRoute = async ({ params }: ProjectRouteProps) => {
  const { id } = await params;
  return <ProjectPage key={id} />;
};

export default ProjectRoute;
