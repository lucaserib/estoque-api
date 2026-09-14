import * as React from "react";
import { cn } from "@/lib/utils";
import { DeltaIndicator } from "@/components/ui/delta-indicator";

interface HeroMetricProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string;
  delta?: number | null;
  deltaLabel?: string;
  context?: string;
}

const HeroMetric = React.forwardRef<HTMLDivElement, HeroMetricProps>(
  ({ label, value, delta, deltaLabel, context, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border border-border bg-card px-6 py-5 shadow-card",
        className
      )}
      {...props}
    >
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <div className="mt-2.5 flex flex-wrap items-baseline gap-3">
        <span className="font-mono text-[40px] font-semibold leading-none tracking-tight tabular-nums text-foreground">
          {value}
        </span>
        {delta !== undefined && delta !== null && (
          <DeltaIndicator delta={delta} label={deltaLabel} />
        )}
      </div>
      {context && <p className="mt-2 text-xs text-faint">{context}</p>}
    </div>
  )
);
HeroMetric.displayName = "HeroMetric";

export { HeroMetric };
