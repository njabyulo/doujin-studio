"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

const Editor = dynamic(
  () => import("./components/editor").then((mod) => mod.Editor),
  {
    ssr: false,
    loading: () => (
      <div className="ds-editor relative min-h-screen overflow-hidden">
        <div className="relative mx-auto w-full max-w-[1200px] px-6 py-10">
          <div className="mb-8 flex items-center justify-between">
            <div className="h-10 w-10 rounded-full bg-white/10" />
            <div className="h-10 w-64 rounded-full bg-white/10" />
            <div className="flex gap-2">
              <div className="h-10 w-10 rounded-full bg-white/10" />
              <div className="h-10 w-10 rounded-full bg-white/10" />
            </div>
          </div>
          <div className="aspect-[16/9] w-full rounded-[32px] bg-white/10" />
          <div className="mt-6 h-20 w-full rounded-[30px] bg-white/10" />
        </div>
      </div>
    ),
  },
);

export function ProjectPage() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id;

  return <Editor key={projectId ?? "new"} projectId={projectId} />;
}
