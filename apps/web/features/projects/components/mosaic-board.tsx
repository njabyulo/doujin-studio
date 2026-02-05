"use client";

import type { ReactNode } from "react";

export type MosaicCard = {
  id: string;
  title?: string;
  subtitle?: string;
  tag?: string;
  imageUrl?: string | null;
  gradient?: string;
  size?: "xl" | "tall" | "wide" | "square" | "short";
  tone?: "light" | "dark";
  accent?: string;
  content?: ReactNode;
};

const SIZE_CLASSES: Record<NonNullable<MosaicCard["size"]>, string> = {
  xl: "col-span-2 row-span-2",
  tall: "row-span-2",
  wide: "col-span-2",
  square: "row-span-1",
  short: "row-span-1",
};

export function MosaicBoard({ cards }: { cards: MosaicCard[] }) {
  return (
    <div className="rounded-[32px] border border-[#e8dccb] bg-[#fbf7f2] p-6 shadow-[0_30px_80px_rgba(27,18,12,0.12)]">
      <div className="grid grid-flow-dense grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4 auto-rows-[140px]">
        {cards.map((card) => {
          const sizeClass = card.size ? SIZE_CLASSES[card.size] : "row-span-1";
          const toneClass =
            card.tone === "dark" ? "text-white" : "text-[#1f1a15]";
          const accent = card.accent ?? "#f58d39";
          const showOverlay = Boolean(card.imageUrl) || card.tone === "dark";

          return (
            <div
              key={card.id}
              className={[
                "group relative overflow-hidden rounded-[28px] border border-white/60 bg-white shadow-[0_20px_45px_rgba(20,14,10,0.12)]",
                sizeClass,
                toneClass,
              ].join(" ")}
              style={{
                backgroundImage: card.gradient,
              }}
            >
              {card.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={card.imageUrl}
                  alt={card.title ?? "Media tile"}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : null}

              {showOverlay ? (
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent opacity-60" />
              ) : null}

              {card.content ? (
                <div className="relative h-full w-full">{card.content}</div>
              ) : (
                <div className="relative flex h-full flex-col justify-between p-4">
                  {card.tag ? (
                    <span
                      className="inline-flex w-fit rounded-full border border-white/60 bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-[#1f1a15]"
                      style={{ boxShadow: `0 8px 20px ${accent}30` }}
                    >
                      {card.tag}
                    </span>
                  ) : (
                    <span />
                  )}

                  <div>
                    {card.title ? (
                      <p className="display-font text-lg font-semibold leading-tight text-white drop-shadow-md">
                        {card.title}
                      </p>
                    ) : null}
                    {card.subtitle ? (
                      <p className="mt-2 text-xs text-white/80 line-clamp-3">
                        {card.subtitle}
                      </p>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
