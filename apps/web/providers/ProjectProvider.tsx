"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface ProjectContextType {
    localVideoFile: File | null;
    setLocalVideoFile: (file: File | null) => void;
    localVideoUrl: string | null;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
    const [localVideoFile, setLocalVideoFile] = useState<File | null>(null);
    const localVideoUrl = React.useMemo(() => {
        if (!localVideoFile) return null;
        return URL.createObjectURL(localVideoFile);
    }, [localVideoFile]);

    useEffect(() => {
        return () => {
            if (localVideoUrl) {
                URL.revokeObjectURL(localVideoUrl);
            }
        };
    }, [localVideoUrl]);

    return (
        <ProjectContext.Provider
            value={{
                localVideoFile,
                setLocalVideoFile,
                localVideoUrl,
            }}
        >
            {children}
        </ProjectContext.Provider>
    );
}

export function useProject() {
    const context = useContext(ProjectContext);
    if (context === undefined) {
        throw new Error("useProject must be used within a ProjectProvider");
    }
    return context;
}
