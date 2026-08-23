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
        "surface-metal rounded-md border-b-2 border-primary px-6 py-5",
        className
      )}
      {...props}
    >
      <p className="text-eyebrow">{label}</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-3">
        <span className="text-display text-[44px] leading-none tabular-nums text-foreground sm:text-[52px]">
          {value}
        </span>
        {delta !== undefined && delta !== null && (
          <DeltaIndicator delta={delta} label={deltaLabel} />
        )}
      </div>
      {context && <p className="mt-2 text-sm text-muted-foreground">{context}</p>}
    </div>
  )
);
HeroMetric.displayName = "HeroMetric";

export { HeroMetric };
