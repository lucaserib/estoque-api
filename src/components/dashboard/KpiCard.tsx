"use client";

import { ArrowDownRight, ArrowUpRight, Minus, Info } from "lucide-react";
import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatPercent } from "@/lib/format";

interface KpiCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  delta?: number | null;
  deltaLabel?: string;
  subtitle?: string;
  tooltip?: string;
  href?: string;
}

const KpiCard = ({
  label,
  value,
  icon: Icon,
  delta,
  deltaLabel,
  subtitle,
  tooltip,
  href,
}: KpiCardProps) => {
  const deltaColor =
    delta === undefined || delta === null || delta === 0
      ? "text-muted-foreground"
      : delta > 0
      ? "text-success"
      : "text-destructive";

  const content = (
    <Card className="rounded-xl transition-shadow duration-200 hover:shadow-md h-full">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13px] text-muted-foreground flex items-center gap-1">
            {label}
            {tooltip && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 shrink-0 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-64 text-xs">
                    {tooltip}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </p>
          <Icon className="h-[18px] w-[18px] text-muted-foreground shrink-0" />
        </div>
        <p className="text-3xl font-bold tabular-nums mt-2 leading-tight">
          {value}
        </p>
        <div className="flex items-center gap-2 mt-1.5 min-h-5">
          {delta !== undefined && delta !== null && (
            <span
              className={`flex items-center gap-0.5 text-[13px] font-medium ${deltaColor}`}
            >
              {delta > 0 ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : delta < 0 ? (
                <ArrowDownRight className="h-3.5 w-3.5" />
              ) : (
                <Minus className="h-3.5 w-3.5" />
              )}
              {delta > 0 ? "+" : ""}
              {formatPercent(delta)}
              {deltaLabel && (
                <span className="text-muted-foreground font-normal ml-1">
                  {deltaLabel}
                </span>
              )}
            </span>
          )}
          {subtitle && (
            <span className="text-[13px] text-muted-foreground truncate">
              {subtitle}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <a href={href} className="block h-full">
        {content}
      </a>
    );
  }

  return content;
};

export default KpiCard;
