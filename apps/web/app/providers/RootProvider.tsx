"use client";

import { ProjectProvider } from "~/providers/ProjectProvider";

export function RootProvider({ children }: { children: React.ReactNode }) {
    return (
        <ProjectProvider>
            {children}
        </ProjectProvider>
    );
}
