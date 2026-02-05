"use client";

import { Film, ImageIcon, Search, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

export type AssetFilter = "all" | "image" | "video" | "render";

export interface AssetItem {
  id: string;
  type: "image" | "video" | "render";
  title: string;
  description: string;
  sceneId?: string;
  sceneIndex?: number;
  placeholderUrl?: string;
  outputUrl?: string | null;
  isNew?: boolean;
}

interface AssetsPanelProps {
  search: string;
  onSearchChange: (value: string) => void;
  filter: AssetFilter;
  onFilterChange: (value: AssetFilter) => void;
  assets: AssetItem[];
  renders: AssetItem[];
  selectedSceneId?: string;
  emptyState?: ReactNode;
  onAssetClick?: (asset: AssetItem) => void;
}

const FILTERS: Array<{
  key: AssetFilter;
  label: string;
  icon: typeof Sparkles;
}> = [
  { key: "all", label: "All", icon: Sparkles },
  { key: "image", label: "Images", icon: ImageIcon },
  { key: "video", label: "Video", icon: Film },
  { key: "render", label: "Renders", icon: Film },
];

export function AssetsPanel({
  search,
  onSearchChange,
  filter,
  onFilterChange,
  assets,
  renders,
  selectedSceneId,
  emptyState,
  onAssetClick,
}: AssetsPanelProps) {
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-white/50">
            Media Library
          </p>
          <p className="mt-1 text-lg font-semibold text-white/90">
            Search, explore, and reuse assets
          </p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">
          {selectedSceneId ? "Scene selected" : "Select a scene to target"}
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1">
          <Label htmlFor="assetSearch" className="sr-only">
            Search assets
          </Label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
          <Input
            id="assetSearch"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search footage by description…"
            className="border-white/10 bg-white/5 pl-9 text-white placeholder:text-white/40"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map(({ key, label, icon: Icon }) => {
            const isActive = filter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onFilterChange(key)}
                className={[
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                  isActive
                    ? "border-[#d8dd5a]/50 bg-[#d8dd5a]/15 text-[#d8dd5a]"
                    : "border-white/10 bg-black/20 text-white/60 hover:text-white/80",
                ].join(" ")}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1">
        {assets.length === 0 && renders.length === 0 ? (
          emptyState ?? (
            <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/5 text-sm text-white/60">
              Generate a storyboard to populate your asset library.
            </div>
          )
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {assets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                onClick={
                  onAssetClick && (asset.type === "video" || asset.type === "render")
                    ? () => onAssetClick(asset)
                    : undefined
                }
              />
            ))}
            {renders.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                onClick={
                  onAssetClick && (asset.type === "video" || asset.type === "render")
                    ? () => onAssetClick(asset)
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AssetCard({
  asset,
  onClick,
}: {
  asset: AssetItem;
  onClick?: () => void;
}) {
  const tag =
    asset.type === "render"
      ? "Render"
      : asset.type === "video"
        ? "Video"
        : "Image";
  const previewUrl = asset.outputUrl ?? asset.placeholderUrl;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={[
        "group relative overflow-hidden rounded-3xl border border-white/10 bg-black/30 p-4 shadow-[var(--shadow-strong)] transition hover:border-white/20 hover:bg-white/5",
        asset.isNew
          ? "animate-in fade-in-0 slide-in-from-bottom-2 duration-500"
          : "",
        onClick ? "cursor-pointer" : "cursor-default",
      ].join(" ")}
    >
      <div className="absolute inset-0 opacity-0 transition group-hover:opacity-100">
        <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br from-[#d8dd5a]/30 to-transparent blur-2xl" />
        <div className="absolute -bottom-20 -left-12 h-40 w-40 rounded-full bg-gradient-to-tr from-orange-400/30 to-transparent blur-2xl" />
      </div>

      <div className="relative flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70">
            {tag}
          </span>
          {typeof asset.sceneIndex === "number" && (
            <span className="text-[11px] text-white/45">
              Scene {asset.sceneIndex + 1}
            </span>
          )}
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          {asset.type === "video" && previewUrl ? (
            <video
              src={previewUrl}
              className="h-40 w-full object-cover"
              muted
              loop
              playsInline
              preload="metadata"
            />
          ) : previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={asset.title}
              className="h-40 w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="h-40 w-full bg-gradient-to-br from-white/10 via-white/5 to-black/30" />
          )}
          {asset.type === "render" && asset.outputUrl && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
              <a
                href={asset.outputUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white"
              >
                Open render
              </a>
            </div>
          )}
        </div>

        <div>
          <p className="text-sm font-semibold text-white/90">
            {asset.title}
          </p>
          <p className="mt-1 text-xs text-white/55 line-clamp-3">
            {asset.description}
          </p>
        </div>
      </div>
    </button>
  );
}
