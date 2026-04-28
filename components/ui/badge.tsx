import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium tracking-[0.02em] transition-[background-color,border-color,color,box-shadow]",
  {
    variants: {
      variant: {
        default:
          "border-cyan-300/25 bg-cyan-300/12 text-cyan-100 shadow-[0_0_0_1px_rgba(116,231,255,0.08)]",
        secondary:
          "border-border/90 bg-secondary text-secondary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        outline: "border-border/90 bg-card/65 text-foreground",
        destructive:
          "border-rose-400/30 bg-rose-500/16 text-rose-50 shadow-[0_0_0_1px_rgba(255,100,127,0.1)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
