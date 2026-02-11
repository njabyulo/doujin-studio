"use client";

import { ProjectProvider } from "~/providers/ProjectProvider";
import { SonnerToaster } from "~/components/ui/sonner";

export const RootProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <ProjectProvider>
      {children}
      <SonnerToaster />
    </ProjectProvider>
  );
};
