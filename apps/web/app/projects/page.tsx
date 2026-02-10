"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus, Film, LogOut } from "lucide-react";
import { Button } from "~/components/ui/button";
import { signOut } from "~/lib/auth-api";
import { useRouter } from "next/navigation";

interface Project {
    id: string;
    title: string;
    role: string;
}

export default function ProjectsPage() {
    const router = useRouter();
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadProjects() {
            try {
                const res = await fetch("/api/projects");
                if (!res.ok) {
                    if (res.status === 401) {
                        router.push("/auth/sign-in");
                        return;
                    }
                    throw new Error("Failed to load projects");
                }
                const data = await res.json();
                setProjects(data.projects);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setIsLoading(false);
            }
        }

        loadProjects();
    }, [router]);

    const handleSignOut = async () => {
        try {
            await signOut();
            router.push("/");
        } catch (err) {
            console.error("Sign out failed", err);
        }
    };

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[color:var(--ds-background)] text-[color:var(--ds-text)]">
                Loading...
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[color:var(--ds-background)]">
            <header className="border-b border-[color:var(--ds-border)] bg-[color:var(--ds-card)] px-6 py-4">
                <div className="mx-auto flex max-w-6xl items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--ds-accent-warm)] text-white">
                            <Film className="h-4 w-4" />
                        </div>
                        <h1 className="text-xl font-bold text-[color:var(--ds-text)]">Doujin Studio</h1>
                    </div>
                    <Button variant="ghost" onClick={handleSignOut} className="gap-2">
                        <LogOut className="h-4 w-4" />
                        Sign out
                    </Button>
                </div>
            </header>

            <main className="mx-auto max-w-6xl p-6">
                <div className="mb-8 flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-[color:var(--ds-text)]">Projects</h2>
                    <Button className="gap-2 rounded-full bg-[color:var(--ds-accent-warm)] text-white hover:bg-[color:var(--ds-accent-warm)]/90">
                        <Plus className="h-4 w-4" />
                        New Project
                    </Button>
                </div>

                {error ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
                        {error}
                    </div>
                ) : projects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-[color:var(--ds-border)] bg-[color:var(--ds-card)] py-20 text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--ds-muted)]/20">
                            <Film className="h-8 w-8 text-[color:var(--ds-muted)]" />
                        </div>
                        <h3 className="text-lg font-medium text-[color:var(--ds-text)]">No projects yet</h3>
                        <p className="mt-1 text-[color:var(--ds-muted)]">Create your first project to get started.</p>
                        <Button className="mt-6 gap-2 rounded-full bg-[color:var(--ds-accent-warm)] text-white hover:bg-[color:var(--ds-accent-warm)]/90">
                            <Plus className="h-4 w-4" />
                            Create Project
                        </Button>
                    </div>
                ) : (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {projects.map((project) => (
                            <Link
                                key={project.id}
                                href={`/projects/${project.id}`}
                                className="group relative overflow-hidden rounded-xl border border-[color:var(--ds-border)] bg-[color:var(--ds-card)] transition-all hover:border-[color:var(--ds-accent-warm)] hover:shadow-lg"
                            >
                                <div className="aspect-video w-full bg-[color:var(--ds-muted)]/10" />
                                <div className="p-4">
                                    <h3 className="font-semibold text-[color:var(--ds-text)]">{project.title}</h3>
                                    <p className="text-sm text-[color:var(--ds-muted)] capitalize">{project.role}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
