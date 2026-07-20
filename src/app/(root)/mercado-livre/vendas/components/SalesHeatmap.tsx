"use client";

import { Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface DayBlockEntry {
  day: number;
  block: number;
  count: number;
}

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const BLOCK_LABELS = ["0–4h", "4–8h", "8–12h", "12–16h", "16–20h", "20–24h"];

const SalesHeatmap = ({ data }: { data: DayBlockEntry[] }) => {
  const counts = new Map(
    data.map((entry) => [`${entry.day}-${entry.block}`, entry.count])
  );
  const maxCount = data.reduce((max, entry) => Math.max(max, entry.count), 0);

  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Vendas por Dia e Horário
        </CardTitle>
      </CardHeader>
      <CardContent>
        {maxCount === 0 ? (
          <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">
            Sem vendas no período selecionado
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[420px]">
              <div className="grid grid-cols-[44px_repeat(6,1fr)] gap-1 text-[11px] text-muted-foreground mb-1">
                <span />
                {BLOCK_LABELS.map((label) => (
                  <span key={label} className="text-center">
                    {label}
                  </span>
                ))}
              </div>
              {DAY_LABELS.map((dayLabel, day) => (
                <div
                  key={dayLabel}
                  className="grid grid-cols-[44px_repeat(6,1fr)] gap-1 mb-1"
                >
                  <span className="text-[11px] text-muted-foreground flex items-center">
                    {dayLabel}
                  </span>
                  {BLOCK_LABELS.map((_, block) => {
                    const count = counts.get(`${day}-${block}`) || 0;
                    const intensity = maxCount > 0 ? count / maxCount : 0;
                    return (
                      <div
                        key={block}
                        title={`${dayLabel} ${BLOCK_LABELS[block]}: ${count} ${
                          count === 1 ? "venda" : "vendas"
                        }`}
                        className="h-8 rounded flex items-center justify-center text-[11px] font-medium tabular-nums"
                        style={{
                          backgroundColor: `hsl(var(--primary) / ${
                            count === 0 ? 0.06 : 0.15 + intensity * 0.75
                          })`,
                          color:
                            intensity > 0.55
                              ? "hsl(var(--primary-foreground))"
                              : "hsl(var(--foreground))",
                        }}
                      >
                        {count > 0 ? count : ""}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SalesHeatmap;
