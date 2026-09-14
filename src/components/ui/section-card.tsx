import * as React from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  contentClassName?: string;
}

const SectionCard = React.forwardRef<HTMLDivElement, SectionCardProps>(
  ({ title, description, actions, className, contentClassName, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-card shadow-card",
        className
      )}
      {...props}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between gap-4 border-b border-divider px-5 py-4">
          <div>
            {title && <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>}
            {description && <p className="mt-1 text-xs text-faint">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn("p-5", contentClassName)}>{children}</div>
    </div>
  )
);
SectionCard.displayName = "SectionCard";

export { SectionCard };
