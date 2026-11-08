import * as React from "react";
import Link from "next/link";
import { Info, type LucideIcon } from "lucide-react";
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
  tooltip?: string;
  href?: string;
  icon?: LucideIcon;
}

interface StatCardProps extends StatCardItem {
  size?: "sm" | "default" | "lg";
  highlight?: boolean;
  className?: string;
}

const iconToneByStatus: Record<StatCardStatus, string> = {
  neutral: "bg-primary/10 text-primary",
  success: "bg-success/15 text-success-text",
  warning: "bg-warning/15 text-warning-text",
  destructive: "bg-destructive/10 text-destructive-text",
};

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
      icon,
      className,
    },
    ref
  ) => {
    const Icone = icon;
    return (
      <div
        ref={ref}
        className={cn(
          "relative min-w-0 overflow-hidden rounded-card border",
          highlight
            ? "bg-hero border-transparent text-white shadow-lift"
            : "card-hover border-border/80 bg-card shadow-card",
          size === "lg" ? "px-5 py-5 sm:px-7 sm:py-6" : "px-5 py-[18px]",
          className
        )}
      >
        {highlight && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl"
          />
        )}
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1.5">
            <p
              className={cn(
                highlight
                  ? "text-sm font-medium text-white/85"
                  : size === "lg"
                  ? "text-sm font-semibold text-foreground"
                  : "text-xs font-medium text-muted-foreground"
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
                      className={highlight ? "text-white/70 hover:text-white" : "text-muted-foreground/70 hover:text-muted-foreground"}
                    >
                      <Info className="h-3 w-3" strokeWidth={1.75} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[240px] text-xs leading-relaxed">{tooltip}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {Icone && (
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                highlight ? "bg-white/15 text-white" : iconToneByStatus[status]
              )}
            >
              <Icone className="h-4 w-4" strokeWidth={2} />
            </span>
          )}
        </div>
        <div className={cn("relative flex flex-wrap items-baseline gap-3", size === "lg" ? "mt-2.5" : Icone ? "mt-1.5" : "mt-3")}>
          <p
            className={cn(
              "break-words font-sans leading-tight tracking-[-0.01em] tabular-nums",
              highlight ? "text-white" : valueToneBySatus[status],
              size === "lg"
                ? "text-[32px] font-semibold sm:text-[40px]"
                : size === "sm"
                ? "text-lg font-semibold"
                : "text-2xl font-semibold sm:text-[27px]"
            )}
          >
            {value}
          </p>
          {delta !== undefined && delta !== null && (
            <DeltaIndicator delta={delta} label={deltaLabel} inverse={highlight} />
          )}
        </div>
        {(note || href) && (
          <div className="relative mt-2.5 flex flex-wrap items-center justify-between gap-1.5">
            {note && <span className={cn("text-xs", highlight ? "text-white/75" : "text-muted-foreground")}>{note}</span>}
            {href && (
              <Link
                href={href}
                className={cn("text-xs font-medium hover:underline", highlight ? "text-white" : "text-primary")}
              >
                Ver detalhes →
              </Link>
            )}
          </div>
        )}
      </div>
    );
  }
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
      className={cn("grid grid-cols-[repeat(auto-fit,minmax(196px,1fr))] gap-4", className)}
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
