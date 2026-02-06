import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]",
  {
    variants: {
      variant: {
        default:
          "border-[color:var(--ds-border)] bg-[color:var(--ds-glass)] text-[color:var(--ds-muted)]",
        outline:
          "border-[color:var(--editor-border)] bg-transparent text-[color:var(--editor-muted)]",
        accent:
          "border-[color:var(--editor-accent)] bg-[color:var(--editor-accent)] text-[#1a1a14]",
        subtle:
          "border-transparent bg-white/10 text-[color:var(--editor-muted)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof badgeVariants>) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
