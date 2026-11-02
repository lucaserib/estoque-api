import * as React from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { DeltaIndicator } from "@/components/ui/delta-indicator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type StatCardStatus = "neutral" | "success" | "warning" | "destructive";

export interface StatCardItem {
  label: string;
  value: string;
  delta?: number | null;
  deltaLabel?: string;
  note?: string;
  status?: StatCardStatus;
  /** Explica de onde o número vem — some tooltip no ícone "i" ao lado do rótulo. */
  tooltip?: string;
  /** Link "Ver detalhes" no canto do cartão. */
  href?: string;
}

interface StatCardProps extends StatCardItem {
  size?: "sm" | "default" | "lg";
  /** Resultado do mês/período: fundo com gradiente sutil da cor da marca em vez de cartão neutro. */
  highlight?: boolean;
  className?: string;
}

const valueToneBySatus: Record<StatCardStatus, string> = {
  neutral: "text-foreground",
  success: "text-success-text",
  warning: "text-warning-text",
  destructive: "text-destructive-text",
};

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  (
    {
      label,
      value,
      delta,
      deltaLabel,
      note,
      status = "neutral",
      tooltip,
      href,
      size = "default",
      highlight = false,
      className,
    },
    ref
  ) => (
    <div
      ref={ref}
      className={cn(
        "min-w-0 rounded-card border border-border shadow-card",
        highlight ? "bg-card-gradient" : "bg-card",
        size === "lg" ? "px-5 py-5 sm:px-6" : "px-5 py-[18px]",
        className
      )}
    >
      <div className="flex items-center gap-1.5">
        <p
          className={cn(
            "text-muted-foreground",
            size === "lg" ? "text-sm font-semibold text-foreground" : "text-xs font-medium"
          )}
        >
          {label}
        </p>
        {tooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={`De onde vem: ${label}`}
                  className="text-muted-foreground/70 hover:text-muted-foreground"
                >
                  <Info className="h-3 w-3" strokeWidth={1.75} />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-[240px] text-xs leading-relaxed">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <div
        className={cn(
          "flex flex-wrap items-baseline gap-3",
          size === "lg" ? "mt-2.5" : "mt-3"
        )}
      >
        <p
          className={cn(
            "break-words font-sans leading-tight tracking-[-0.01em] tabular-nums",
            valueToneBySatus[status],
            size === "lg"
              ? "text-[32px] font-semibold sm:text-[40px]"
              : size === "sm"
              ? "text-lg font-semibold"
              : "text-2xl font-semibold sm:text-[27px]"
          )}
        >
          {value}
        </p>
        {delta !== undefined && delta !== null && <DeltaIndicator delta={delta} label={deltaLabel} />}
      </div>
      {(note || href) && (
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1.5">
          {note && <span className="text-xs text-muted-foreground">{note}</span>}
          {href && (
            <Link href={href} className="text-xs font-medium text-primary hover:underline">
              Ver detalhes →
            </Link>
          )}
        </div>
      )}
    </div>
  )
);
StatCard.displayName = "StatCard";

interface StatCardGridProps extends React.HTMLAttributes<HTMLDivElement> {
  items: StatCardItem[];
  size?: "sm" | "default";
}

const StatCardGrid = React.forwardRef<HTMLDivElement, StatCardGridProps>(
  ({ items, size = "default", className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("grid grid-cols-[repeat(auto-fit,minmax(216px,1fr))] gap-4", className)}
      {...props}
    >
      {items.map((item) => (
        <StatCard key={item.label} {...item} size={size} />
      ))}
    </div>
  )
);
StatCardGrid.displayName = "StatCardGrid";

export { StatCard, StatCardGrid };
