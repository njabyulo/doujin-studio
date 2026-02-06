import * as React from "react";

import { cn } from "~/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-2xl border border-[color:var(--ds-border)] bg-[color:var(--ds-glass)] px-4 py-2 text-sm text-[color:var(--ds-text)] shadow-[var(--ds-shadow-soft)] outline-none transition focus-visible:border-[color:var(--ds-accent)] focus-visible:ring-2 focus-visible:ring-[color:var(--ds-accent)]/30 disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
