import * as React from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  actions?: React.ReactNode;
  contentClassName?: string;
}

const SectionCard = React.forwardRef<HTMLDivElement, SectionCardProps>(
  ({ title, actions, className, contentClassName, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-md border border-metal bg-card shadow-none dark:shadow-none",
        className
      )}
      {...props}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between gap-4 border-b border-metal px-5 py-3">
          {title && <h3 className="text-eyebrow">{title}</h3>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn("p-5", contentClassName)}>{children}</div>
    </div>
  )
);
SectionCard.displayName = "SectionCard";

export { SectionCard };
