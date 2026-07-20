"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatBRL, formatBRLReais, formatNumberBR } from "@/lib/format";
import { LucideIcon } from "lucide-react";

export type MetricFormat = "number" | "brl-reais" | "brl-centavos" | "text";

interface MLMetricsCardProps {
  title: string;
  value: string | number;
  format?: MetricFormat;
  subtitle?: string;
  icon: LucideIcon;
  badge?: {
    text: string;
    variant?: "default" | "destructive" | "secondary" | "outline";
  };
  progress?: {
    value: number;
    label: string;
  };
  details?: Array<{
    label: string;
    value: string | number;
    format?: MetricFormat;
  }>;
}

const formatMetric = (
  value: string | number,
  format: MetricFormat
): string => {
  if (typeof value !== "number") return value;
  switch (format) {
    case "brl-reais":
      return formatBRLReais(value);
    case "brl-centavos":
      return formatBRL(value);
    case "number":
      return formatNumberBR(value);
    default:
      return String(value);
  }
};

export default function MLMetricsCard({
  title,
  value,
  format = "number",
  subtitle,
  icon: Icon,
  badge,
  progress,
  details,
}: MLMetricsCardProps) {
  return (
    <Card className="rounded-xl transition-shadow duration-200 hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-[13px] text-muted-foreground truncate">
              {title}
            </p>
            {badge && (
              <Badge
                variant={badge.variant || "default"}
                className="text-xs rounded-full"
              >
                {badge.text}
              </Badge>
            )}
          </div>
          <Icon className="h-[18px] w-[18px] text-muted-foreground shrink-0" />
        </div>

        <p className="text-3xl font-bold tabular-nums mt-2 leading-tight">
          {formatMetric(value, format)}
        </p>

        {subtitle && (
          <p className="text-[13px] text-muted-foreground mt-1.5">
            {subtitle}
          </p>
        )}

        {progress && (
          <div className="mt-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-muted-foreground">
                {progress.label}
              </span>
              <span className="text-xs font-medium tabular-nums">
                {progress.value}%
              </span>
            </div>
            <Progress value={progress.value} className="h-1.5" />
          </div>
        )}

        {details && details.length > 0 && (
          <div className="mt-3 space-y-1">
            {details.map((detail) => (
              <div
                key={detail.label}
                className="flex justify-between text-xs"
              >
                <span className="text-muted-foreground">{detail.label}</span>
                <span className="font-medium tabular-nums">
                  {formatMetric(detail.value, detail.format ?? "number")}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
