import * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(
  ({ title, eyebrow, subtitle, actions, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-wrap items-end justify-between gap-5", className)}
      {...props}
    >
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-2 flex items-center gap-1.5 text-xs">
            <span className="text-faint">{eyebrow}</span>
            <span className="text-border">/</span>
            <span className="text-muted-foreground">{title}</span>
          </div>
        )}
        <h1 className="text-[27px] font-semibold leading-tight tracking-[-0.015em] text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  )
);
PageHeader.displayName = "PageHeader";

export { PageHeader };
