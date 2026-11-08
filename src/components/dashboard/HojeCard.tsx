"use client";

import { useCallback, useEffect, useState } from "react";
import { SectionCard } from "@/components/ui/section-card";
import { StatCardGrid, type StatCardItem } from "@/components/ui/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL, formatPercent } from "@/lib/format";

interface ResumoDiaResponse {
  indicadores: {
    receitaTotal: number;
    pedidos: number;
    unidades: number;
    margemContribuicao: number;
    margemContribuicaoPercentual: number | null;
  };
  comparacaoOntem: { faturamento: { percentual: number | null } };
  valorALiberarHoje: number;
}

const INTERVALO_MS = 2 * 60 * 1000;

function variacao(percentual: number | null | undefined): number | null {
  return percentual == null ? null : Math.round(percentual * 1000) / 10;
}

function percentualTexto(fracao: number | null): string {
  return fracao == null || !Number.isFinite(fracao) ? "—" : formatPercent(fracao * 100, 1);
}

export function HojeCard() {
  const [dados, setDados] = useState<ResumoDiaResponse | null | false>(null);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/financeiro/resumo-dia");
      if (!res.ok) {
        setDados(false);
        return;
      }
      setDados(await res.json());
    } catch {
      setDados(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    const intervalo = setInterval(carregar, INTERVALO_MS);
    return () => clearInterval(intervalo);
  }, [carregar]);

  if (dados === false) return null;

  const itens: StatCardItem[] = dados
    ? [
        {
          label: "Faturamento",
          value: formatBRL(dados.indicadores.receitaTotal),
          delta: variacao(dados.comparacaoOntem.faturamento.percentual),
          deltaLabel: "vs. ontem",
        },
        { label: "Pedidos", value: String(dados.indicadores.pedidos), note: `${dados.indicadores.unidades} unidades` },
        {
          label: "Margem de contribuição",
          value: formatBRL(dados.indicadores.margemContribuicao),
          note: percentualTexto(dados.indicadores.margemContribuicaoPercentual),
        },
        { label: "Liberado hoje no Mercado Pago", value: formatBRL(dados.valorALiberarHoje) },
      ]
    : [];

  return (
    <SectionCard title="Hoje" description="Comparado com ontem">
      {dados ? <StatCardGrid size="sm" items={itens} /> : <Skeleton className="h-24 rounded-md" />}
    </SectionCard>
  );
}
