"use client";

import { Toaster } from "sonner";

export const SonnerToaster = () => {
  return (
    <Toaster
      position="bottom-right"
      closeButton
      expand
      toastOptions={{
        duration: 5000,
        unstyled: true,
        classNames: {
          toast:
            "group pointer-events-auto w-[360px] max-w-[calc(100vw-2rem)] rounded-[22px] border border-[color:var(--editor-border)] bg-[color:var(--editor-panel-strong)] px-4 py-3 text-[#f7f2e8] shadow-[var(--editor-shadow)] backdrop-blur-xl",
          title:
            "display-font text-[15px] font-semibold leading-tight tracking-[-0.01em]",
          description:
            "mt-1 text-[13px] leading-snug text-[rgba(247,242,238,0.68)]",
          actionButton:
            "ml-2 inline-flex h-8 items-center justify-center rounded-full bg-[color:var(--editor-accent)] px-3 text-xs font-semibold text-[#1a1a14] shadow-[0_14px_40px_rgba(216,221,90,0.25)]",
          cancelButton:
            "ml-2 inline-flex h-8 items-center justify-center rounded-full border border-[color:var(--editor-border)] bg-white/10 px-3 text-xs font-semibold text-[#f7f2e8]",
          closeButton:
            "rounded-full border border-[color:var(--editor-border)] bg-white/10 text-[#f7f2e8]/80 hover:bg-white/15 hover:text-[#f7f2e8]",
          success: "ring-1 ring-[rgba(216,221,90,0.35)]",
          error: "ring-1 ring-[rgba(245,141,57,0.38)]",
          warning: "ring-1 ring-[rgba(245,141,57,0.32)]",
          info: "ring-1 ring-[rgba(190,215,255,0.35)]",
        },
      }}
    />
  );
};
