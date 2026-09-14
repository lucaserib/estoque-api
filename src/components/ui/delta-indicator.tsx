import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

interface DeltaIndicatorProps {
  delta?: number | null;
  label?: string;
  className?: string;
}

export function DeltaIndicator({ delta, label, className }: DeltaIndicatorProps) {
  const isEmpty = delta === undefined || delta === null || delta === 0;
  const toneClass = isEmpty
    ? "bg-secondary text-muted-foreground"
    : delta > 0
    ? "bg-success/10 text-success"
    : "bg-destructive/10 text-destructive";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
        toneClass,
        className
      )}
    >
      {isEmpty ? "—" : `${delta > 0 ? "+" : ""}${formatPercent(delta)}`}
      {label && <span className="font-normal opacity-70">{label}</span>}
    </span>
  );
}
