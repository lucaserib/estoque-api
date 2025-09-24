"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { exibirValorEmReais } from "@/utils/currency";
import { LucideIcon } from "lucide-react";

interface MLMetricsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color: "green" | "blue" | "orange" | "red" | "purple";
  badge?: {
    text: string;
    variant?: "default" | "destructive" | "secondary" | "outline";
  };
  trend?: "up" | "down" | "neutral";
  progress?: {
    value: number;
    label: string;
  };
  details?: Array<{
    label: string;
    value: string | number;
    color?: string;
    isValue?: boolean; // ✅ NOVO: Para indicar que é um valor monetário
  }>;
}

export default function MLMetricsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  badge,
  trend,
  progress,
  details,
}: MLMetricsCardProps) {
  const getColorClasses = (color: string) => {
    const colorMap = {
      green: {
        text: "text-green-600",
        bg: "bg-green-50",
        icon: "text-green-600",
      },
      blue: {
        text: "text-blue-600",
        bg: "bg-blue-50",
        icon: "text-blue-600",
      },
      orange: {
        text: "text-orange-600",
        bg: "bg-orange-50",
        icon: "text-orange-600",
      },
      red: {
        text: "text-red-600",
        bg: "bg-red-50",
        icon: "text-red-600",
      },
      purple: {
        text: "text-purple-600",
        bg: "bg-purple-50",
        icon: "text-purple-600",
      },
    };
    return colorMap[color as keyof typeof colorMap] || colorMap.blue;
  };

  const colors = getColorClasses(color);

  const formatValue = (val: string | number) => {
    if (typeof val === "number") {
      // Se parece com um valor monetário em centavos
      if (val > 10000 && val % 100 === 0) {
        return exibirValorEmReais(val);
      }
      return val.toLocaleString("pt-BR");
    }
    return val;
  };

  return (
    <Card className="transition-all duration-200 hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            {/* Título e Badge */}
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm text-muted-foreground">{title}</p>
              {badge && (
                <Badge variant={badge.variant || "default"} className="text-xs">
                  {badge.text}
                </Badge>
              )}
            </div>

            {/* Valor Principal */}
            <p className={`text-2xl font-bold ${colors.text}`}>
              {formatValue(value)}
            </p>

            {/* Subtítulo */}
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}

            {/* Progresso */}
            {progress && (
              <div className="mt-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-muted-foreground">
                    {progress.label}
                  </span>
                  <span className="text-xs font-medium">
                    {progress.value}%
                  </span>
                </div>
                <Progress value={progress.value} className="h-2" />
              </div>
            )}

            {/* Detalhes */}
            {details && details.length > 0 && (
              <div className="mt-2 space-y-1">
                {details.map((detail, index) => (
                  <div key={index} className="flex justify-between text-xs">
                    <span className={detail.color || "text-muted-foreground"}>
                      {detail.label}
                    </span>
                    <span className="font-medium">
                      {detail.isValue && typeof detail.value === 'number'
                        ? exibirValorEmReais(detail.value)
                        : formatValue(detail.value)
                      }
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ícone */}
          <div className="flex items-center ml-4">
            <div className={`p-2 rounded-lg ${colors.bg}`}>
              <Icon className={`h-6 w-6 ${colors.icon}`} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
