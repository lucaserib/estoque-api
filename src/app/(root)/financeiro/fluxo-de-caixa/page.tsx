"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatStrip, type StatStripItem } from "@/components/ui/stat-strip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatBRL, formatDateBR } from "@/lib/format";
import { chartColor } from "@/lib/chart-colors";
import { SeletorPeriodo, periodoDoPreset, type PeriodoSelecionado } from "../components/SeletorPeriodo";
import { useAcessoFinanceiro } from "../components/useAcessoFinanceiro";

type Granularidade = "DIA" | "SEMANA" | "MES";

interface PontoFluxo {
  periodo: string;
  realizado: number;
  previsto: number;
}

interface SaldoProjetado {
  dias: 30 | 60 | 90;
  saldoInicial: number;
  liberacoesFuturas: number;
  lancamentosPrevistos: number;
  saldoProjetado: number;
}

export default function FluxoDeCaixaPage() {
  const { carregando: carregandoSessao, podeVerFinanceiro } = useAcessoFinanceiro();

  const [periodo, setPeriodo] = useState<PeriodoSelecionado>({ preset: "mesAtual", ...periodoDoPreset("mesAtual") });
  const [granularidade, setGranularidade] = useState<Granularidade>("DIA");
  const [pontos, setPontos] = useState<PontoFluxo[]>([]);
  const [carregandoFluxo, setCarregandoFluxo] = useState(true);

  const [dias, setDias] = useState<30 | 60 | 90>(30);
  const [saldo, setSaldo] = useState<SaldoProjetado | null>(null);
  const [carregandoSaldo, setCarregandoSaldo] = useState(true);

  const carregarFluxo = useCallback(async () => {
    setCarregandoFluxo(true);
    try {
      const params = new URLSearchParams({
        desde: periodo.desde.toISOString(),
        ate: periodo.ate.toISOString(),
        granularidade,
      });
      const resposta = await fetch(`/api/financeiro/fluxo-caixa?${params.toString()}`);
      if (resposta.ok) setPontos((await resposta.json()).pontos);
    } catch (error) {
      console.error("Erro ao carregar fluxo de caixa:", error);
    } finally {
      setCarregandoFluxo(false);
    }
  }, [periodo, granularidade]);

  const carregarSaldo = useCallback(async () => {
    setCarregandoSaldo(true);
    try {
      const resposta = await fetch(`/api/financeiro/fluxo-caixa/saldo-projetado?dias=${dias}`);
      if (resposta.ok) setSaldo(await resposta.json());
    } catch (error) {
      console.error("Erro ao carregar saldo projetado:", error);
    } finally {
      setCarregandoSaldo(false);
    }
  }, [dias]);

  useEffect(() => {
    if (podeVerFinanceiro) carregarFluxo();
  }, [podeVerFinanceiro, carregarFluxo]);

  useEffect(() => {
    if (podeVerFinanceiro) carregarSaldo();
  }, [podeVerFinanceiro, carregarSaldo]);

  if (carregandoSessao || !podeVerFinanceiro) {
    return (
      <div className="container mx-auto max-w-[1400px] space-y-8 p-6">
        <Skeleton className="h-[80px] rounded-md" />
      </div>
    );
  }

  const itensSaldo: StatStripItem[] = saldo
    ? [
        { label: "Saldo inicial das contas", value: formatBRL(saldo.saldoInicial) },
        { label: "Liberações futuras (ML)", value: formatBRL(saldo.liberacoesFuturas) },
        { label: "Lançamentos previstos", value: formatBRL(saldo.lancamentosPrevistos) },
        { label: `Saldo projetado em ${saldo.dias} dias`, value: formatBRL(saldo.saldoProjetado) },
      ]
    : [];

  return (
    <div className="container mx-auto max-w-[1400px] space-y-6 p-6">
      <PageHeader eyebrow="Financeiro" title="Fluxo de caixa" subtitle="Realizado × previsto, e a projeção de saldo." />

      <SectionCard title="Realizado × previsto">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <SeletorPeriodo valor={periodo} onChange={setPeriodo} />
          <Select value={granularidade} onValueChange={(v) => setGranularidade(v as Granularidade)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="DIA">Por dia</SelectItem>
              <SelectItem value="SEMANA">Por semana</SelectItem>
              <SelectItem value="MES">Por mês</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {carregandoFluxo ? (
          <Skeleton className="h-[320px] rounded-md" />
        ) : pontos.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Sem movimentos no período.</div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={pontos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="periodo" tickFormatter={(v) => formatDateBR(v)} tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => formatBRL(v)} width={90} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(valor: number) => formatBRL(valor)} labelFormatter={(v) => formatDateBR(v)} />
              <Bar dataKey="realizado" name="Realizado" fill={chartColor(0)} />
              <Bar dataKey="previsto" name="Previsto" fill={chartColor(1)} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      <SectionCard title="Saldo projetado">
        <div className="mb-4">
          <Select value={String(dias)} onValueChange={(v) => setDias(Number(v) as 30 | 60 | 90)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Próximos 30 dias</SelectItem>
              <SelectItem value="60">Próximos 60 dias</SelectItem>
              <SelectItem value="90">Próximos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {carregandoSaldo ? <Skeleton className="h-[100px] rounded-md" /> : <StatStrip items={itensSaldo} />}
        <p className="mt-3 text-xs text-muted-foreground">
          Saldo inicial vem do que está configurado em cada conta financeira; contas de cartão de crédito não entram, pois representam dívida, não dinheiro disponível.
        </p>
      </SectionCard>
    </div>
  );
}
