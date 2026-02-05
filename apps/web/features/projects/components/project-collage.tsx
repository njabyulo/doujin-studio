"use client";

import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

type TileTone = "light" | "dark";
type TileSize = "hero" | "tall" | "medium" | "short";

const SIZE_CLASS: Record<TileSize, string> = {
  hero: "min-h-[520px]",
  tall: "min-h-[380px]",
  medium: "min-h-[280px]",
  short: "min-h-[220px]",
};

export function ProjectCollage({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="rounded-[32px] border border-[color:var(--ds-border-light)] bg-[color:var(--ds-bg-light)] p-6 shadow-[0_30px_80px_rgba(27,18,12,0.12)]">
      <div className="columns-1 [column-gap:1.25rem] sm:columns-2 lg:columns-3 xl:columns-4">
        {children}
      </div>
    </div>
  );
}

export function CollageTile({
  tone = "light",
  size = "medium",
  className,
  children,
  onClick,
}: {
  tone?: TileTone;
  size?: TileSize;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  const baseTone =
    tone === "dark"
      ? "border-white/10 bg-[color:var(--ds-bg-dark-2)] text-white"
      : "border-[color:var(--ds-border-light)] bg-[color:var(--ds-surface-light)] text-[color:var(--ds-text-light)]";

  return (
    <div
      className={cn(
        "mb-4 break-inside-avoid overflow-hidden rounded-[28px] border shadow-[0_18px_45px_rgba(27,18,12,0.12)]",
        SIZE_CLASS[size],
        baseTone,
        onClick ? "cursor-pointer transition hover:translate-y-[-2px]" : "",
        className,
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}
