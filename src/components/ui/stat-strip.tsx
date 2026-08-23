import * as React from "react";
import { cn } from "@/lib/utils";
import { DeltaIndicator } from "@/components/ui/delta-indicator";

export interface StatStripItem {
  label: string;
  value: string;
  delta?: number | null;
}

interface StatStripProps extends React.HTMLAttributes<HTMLDivElement> {
  items: StatStripItem[];
  size?: "default" | "sm";
}

const StatStrip = React.forwardRef<HTMLDivElement, StatStripProps>(
  ({ items, size = "default", className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "grid grid-cols-2 gap-x-6 gap-y-4 sm:flex sm:gap-0 sm:divide-x sm:divide-border",
        className
      )}
      {...props}
    >
      {items.map((item) => (
        <div key={item.label} className="sm:flex-1 sm:px-4 sm:first:pl-0">
          <p className="text-eyebrow">{item.label}</p>
          <div className="mt-1 flex items-center gap-2">
            <span
              className={cn(
                "tabular-nums font-semibold text-foreground",
                size === "sm" ? "text-base" : "text-xl"
              )}
            >
              {item.value}
            </span>
            {item.delta !== undefined && item.delta !== null && (
              <DeltaIndicator delta={item.delta} />
            )}
          </div>
        </div>
      ))}
    </div>
  )
);
StatStrip.displayName = "StatStrip";

export { StatStrip };
