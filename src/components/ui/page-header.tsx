import * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(
  ({ title, subtitle, actions, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-wrap items-start justify-between gap-4",
        className
      )}
      {...props}
    >
      <div className="flex gap-3">
        <span className="mt-1 h-7 w-[3px] shrink-0 rounded-full bg-primary" />
        <div>
          <h1 className="text-display text-2xl uppercase text-foreground">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  )
);
PageHeader.displayName = "PageHeader";

export { PageHeader };
