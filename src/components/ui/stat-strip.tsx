import * as React from "react";
import { cn } from "@/lib/utils";
import { DeltaIndicator } from "@/components/ui/delta-indicator";

export interface StatStripItem {
  label: string;
  value: string;
  delta?: number | null;
  note?: string;
}

interface StatStripProps extends React.HTMLAttributes<HTMLDivElement> {
  items: StatStripItem[];
  size?: "default" | "sm";
}

const StatStrip = React.forwardRef<HTMLDivElement, StatStripProps>(
  ({ items, size = "default", className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("grid grid-cols-[repeat(auto-fit,minmax(216px,1fr))] gap-4", className)}
      {...props}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className="min-w-0 rounded-lg border border-border bg-card px-5 py-[18px] shadow-card"
        >
          <p className="text-sm text-muted-foreground">{item.label}</p>
          <p
            className={cn(
              // leading-tight + break-words: valor longo quebra em linha nova sem sobrepor a de cima
              "mt-3 break-words font-mono font-semibold leading-tight tracking-tight tabular-nums text-foreground",
              size === "sm" ? "text-lg" : "text-2xl sm:text-[27px]"
            )}
          >
            {item.value}
          </p>
          {((item.delta !== undefined && item.delta !== null) || item.note) && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {item.delta !== undefined && item.delta !== null && (
                <DeltaIndicator delta={item.delta} />
              )}
              {item.note && <span className="text-xs text-faint">{item.note}</span>}
            </div>
          )}
        </div>
      ))}
    </div>
  )
);
StatStrip.displayName = "StatStrip";

export { StatStrip };
