"use client";

import dynamic from "next/dynamic";
import { useParams, useSearchParams } from "next/navigation";

const Editor = dynamic(
  () => import("./components/editor").then((mod) => mod.Editor),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Loading editor…</p>
      </div>
    ),
  },
);

export function ProjectPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const projectId = params?.id;

  return (
    <Editor
      projectId={projectId}
      initialGenerate={
        searchParams
          ? {
              url: searchParams.get("url") ?? undefined,
              format: (searchParams.get("format") as
                | "1:1"
                | "9:16"
                | "16:9"
                | undefined) ?? undefined,
              tone: searchParams.get("tone") ?? undefined,
            }
          : undefined
      }
    />
  );
}
