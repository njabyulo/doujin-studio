import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmptyState } from "~/components/domain/empty-state";

describe("EmptyState", () => {
  const mockCallbacks = {
    onUrlSubmit: vi.fn(),
    onProjectSelect: vi.fn(),
    onDemoProject: vi.fn(),
  };

  it("should render with no projects", () => {
    render(<EmptyState recentProjects={[]} {...mockCallbacks} />);

    expect(screen.getByText("Create Your Media")).toBeInTheDocument();
    expect(screen.getByLabelText("Prompt or URL")).toBeInTheDocument();
    expect(screen.getByText("Try one of these examples:")).toBeInTheDocument();
    expect(screen.getByText("Try Demo Project")).toBeInTheDocument();
    expect(screen.queryByText("Recent Projects")).not.toBeInTheDocument();
  });

  it("should render with recent projects", () => {
    const recentProjects = [
      {
        id: "1",
        title: "Project 1",
        updatedAt: new Date("2024-01-15"),
      },
      {
        id: "2",
        title: "Project 2",
        updatedAt: new Date("2024-01-14"),
      },
    ];

    render(<EmptyState recentProjects={recentProjects} {...mockCallbacks} />);

    expect(screen.getByText("Create Your Media")).toBeInTheDocument();
    expect(screen.getByLabelText("Prompt or URL")).toBeInTheDocument();
    expect(screen.getByText("Recent Projects")).toBeInTheDocument();
    expect(screen.getByText("Project 1")).toBeInTheDocument();
    expect(screen.getByText("Project 2")).toBeInTheDocument();
    expect(
      screen.queryByText("Try one of these examples:"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Try Demo Project")).not.toBeInTheDocument();
  });
});
