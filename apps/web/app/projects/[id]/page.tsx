import { ProjectPage } from "~/features/projects/project-page";

interface ProjectRouteProps {
  params: { id: string };
}

export default function ProjectRoute({ params }: ProjectRouteProps) {
  return <ProjectPage key={params.id} />;
}
