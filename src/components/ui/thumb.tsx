import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const thumbVariants = cva(
  "flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md text-xs font-semibold",
  {
    variants: {
      tone: {
        primary: "bg-primary/10 text-primary",
        success: "bg-success/10 text-success",
        warning: "bg-warning/10 text-warning",
        destructive: "bg-destructive/10 text-destructive",
        info: "bg-info/10 text-info",
        neutral: "bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  }
);

interface ThumbProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof thumbVariants> {
  initials: string;
}

function Thumb({ initials, tone, className, ...props }: ThumbProps) {
  return (
    <div className={cn(thumbVariants({ tone }), className)} {...props}>
      {initials}
    </div>
  );
}

export { Thumb, thumbVariants };
