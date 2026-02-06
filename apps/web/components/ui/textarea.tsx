import * as React from "react";

import { cn } from "~/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[96px] w-full resize-none rounded-2xl border border-[color:var(--ds-border)] bg-[color:var(--ds-glass)] px-4 py-3 text-sm text-[color:var(--ds-text)] shadow-[var(--ds-shadow-soft)] outline-none transition focus-visible:border-[color:var(--ds-accent)] focus-visible:ring-2 focus-visible:ring-[color:var(--ds-accent)]/30 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
