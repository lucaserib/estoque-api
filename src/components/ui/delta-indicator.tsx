import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

interface DeltaIndicatorProps {
  delta?: number | null;
  label?: string;
  className?: string;
}

export function DeltaIndicator({ delta, label, className }: DeltaIndicatorProps) {
  const isEmpty = delta === undefined || delta === null || delta === 0;
  const color = isEmpty
    ? "text-muted-foreground"
    : delta > 0
    ? "text-success"
    : "text-destructive";
  const Icon = isEmpty ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", color, className)}>
      <Icon className="h-3.5 w-3.5" />
      {!isEmpty && delta > 0 ? "+" : ""}
      {isEmpty ? "—" : formatPercent(delta)}
      {label && <span className="text-muted-foreground font-normal">{label}</span>}
    </span>
  );
}
