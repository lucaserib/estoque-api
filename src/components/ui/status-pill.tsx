import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusPillVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
  {
    variants: {
      tone: {
        critical: "bg-destructive/[0.12] text-destructive",
        warning: "bg-warning/[0.12] text-warning",
        success: "bg-success/[0.12] text-success",
        info: "bg-info/[0.12] text-info",
        neutral: "bg-muted-foreground/[0.12] text-muted-foreground",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  }
);

interface StatusPillProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusPillVariants> {}

function StatusPill({ tone, className, ...props }: StatusPillProps) {
  return <span className={cn(statusPillVariants({ tone }), className)} {...props} />;
}

export { StatusPill, statusPillVariants };
