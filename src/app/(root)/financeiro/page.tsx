"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { HeroMetric } from "@/components/ui/hero-metric";
import { StatStrip, type StatStripItem } from "@/components/ui/stat-strip";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL, formatPercent, formatDateBR } from "@/lib/format";
import { chartColor } from "@/lib/chart-colors";
import { SeletorPeriodo, periodoDoPreset, type PeriodoSelecionado } from "./components/SeletorPeriodo";
import { useAcessoFinanceiro } from "./components/useAcessoFinanceiro";

interface ResumoDiaResponse {
  faturamentoBruto: number;
  pedidos: number;
  margemContribuicao: number;
  lucroEstimado: number;
  comparacaoOntem: { faturamentoBruto: { percentual: number | null } };
  contasAPagar: {
    vencendoHoje: { quantidade: number; valor: number };
    vencidas: { quantidade: number; valor: number };
  };
}

interface ResumoPeriodoResponse {
  faturamentoBruto: number;
  cancelamentos: number;
  descontos: number;
  impostos: number;
  tarifas: number;
  frete: number;
  ads: number;
  cmv: number;
  margemContribuicao: number;
  margemContribuicaoPercentual: number | null;
  ticketMedio: number | null;
  lucroLiquido: number;
  pontoEquilibrioMes: { faltaVender: number | null };
}

interface PontoSerie {
  dia: string;
  faturamentoBruto: number;
  margemContribuicao: number;
}

interface ProdutoLinha {
  produtoId: string;
  sku: string;
  nome: string;
  lucroLiquido: number;
  margemContribuicaoPercentual: number | null;
}

interface VendaPrejuizo {
  id: string;
  pedidoExternoId: string;
  dataVenda: string;
  margemContribuicao: number | null;
}

interface SaldoProjetadoResponse {
  saldoProjetado: number;
}

interface LinhaConciliacaoAlerta {
  tipo: string;
  alerta: boolean;
  diferenca: number;
}

async function buscarJson<T>(url: string): Promise<T | null> {
  try {
    const resposta = await fetch(url);
    if (!resposta.ok) return null;
    return (await resposta.json()) as T;
  } catch {
    return null;
  }
}

function construirDadosCascata(resumo: ResumoPeriodoResponse) {
  const despesaFixaRateada = resumo.margemContribuicao - resumo.lucroLiquido;
  const passos = [
    { nome: "Faturamento", valor: resumo.faturamentoBruto },
    { nome: "Cancel./desc.", valor: -(resumo.cancelamentos + resumo.descontos) },
    { nome: "Impostos", valor: -resumo.impostos },
    { nome: "Tarifas", valor: -resumo.tarifas },
    { nome: "Frete", valor: -resumo.frete },
    { nome: "Ads", valor: -resumo.ads },
    { nome: "CMV", valor: -resumo.cmv },
    { nome: "Desp. fixas", valor: -despesaFixaRateada },
  ];

  let acumulado = 0;
  const dados = passos.map((passo) => {
    const inicio = acumulado;
    acumulado += passo.valor;
    return {
      nome: passo.nome,
      base: Math.min(inicio, acumulado),
      altura: Math.abs(passo.valor),
      positivo: passo.valor >= 0,
    };
  });
  dados.push({ nome: "Lucro líquido", base: 0, altura: Math.abs(acumulado), positivo: acumulado >= 0 });
  return dados;
}

export default function FinanceiroPage() {
  const { carregando: carregandoSessao, podeVerFinanceiro } = useAcessoFinanceiro();
  const [periodo, setPeriodo] = useState<PeriodoSelecionado>({ preset: "mesAtual", ...periodoDoPreset("mesAtual") });
  const [carregando, setCarregando] = useState(true);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);

  const [resumoHoje, setResumoHoje] = useState<ResumoDiaResponse | null>(null);
  const [resumoPeriodo, setResumoPeriodo] = useState<ResumoPeriodoResponse | null>(null);
  const [serieDiaria, setSerieDiaria] = useState<PontoSerie[]>([]);
  const [topProdutos, setTopProdutos] = useState<ProdutoLinha[]>([]);
  const [piorProdutos, setPiorProdutos] = useState<ProdutoLinha[]>([]);
  const [vendasComPrejuizo, setVendasComPrejuizo] = useState<VendaPrejuizo[]>([]);
  const [vendasIncompletasTotal, setVendasIncompletasTotal] = useState(0);
  const [saldoProjetado, setSaldoProjetado] = useState<number | null>(null);
  const [alertaConciliacao, setAlertaConciliacao] = useState<LinhaConciliacaoAlerta[]>([]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const hoje = new Date();
    const desdeIso = periodo.desde.toISOString();
    const ateIso = periodo.ate.toISOString();
    const mesAtualIso = `${hoje.getUTCFullYear()}-${String(hoje.getUTCMonth() + 1).padStart(2, "0")}`;

    const [
      resumoDiaResp,
      resumoPeriodoResp,
      serieResp,
      produtosResp,
      vendasPrejuizoResp,
      vendasIncompletasResp,
      saldoResp,
      conciliacaoResp,
    ] = await Promise.all([
      buscarJson<ResumoDiaResponse>("/api/financeiro/resumo-dia"),
      buscarJson<ResumoPeriodoResponse>(`/api/financeiro/resumo-periodo?desde=${desdeIso}&ate=${ateIso}`),
      buscarJson<{ pontos: PontoSerie[] }>(`/api/financeiro/serie-diaria?desde=${desdeIso}&ate=${ateIso}`),
      buscarJson<{ produtos: ProdutoLinha[] }>(
        `/api/financeiro/produtos?desde=${desdeIso}&ate=${ateIso}&ordenarPor=lucroLiquido&ordem=desc`
      ),
      buscarJson<{ vendas: VendaPrejuizo[]; total: number }>(
        `/api/financeiro/vendas?desde=${desdeIso}&ate=${ateIso}&soPrejuizo=true&porPagina=10`
      ),
      buscarJson<{ total: number }>(`/api/financeiro/vendas?desde=${desdeIso}&ate=${ateIso}&soIncompletas=true&porPagina=1`),
      buscarJson<SaldoProjetadoResponse>("/api/financeiro/fluxo-caixa/saldo-projetado?dias=30"),
      buscarJson<{ linhas: LinhaConciliacaoAlerta[] }>(`/api/financeiro/conciliacao?mes=${mesAtualIso}`),
    ]);

    setResumoHoje(resumoDiaResp);
    setResumoPeriodo(resumoPeriodoResp);
    setSerieDiaria(serieResp?.pontos ?? []);
    const produtosOrdenados = produtosResp?.produtos ?? [];
    setTopProdutos(produtosOrdenados.slice(0, 10));
    setPiorProdutos([...produtosOrdenados].reverse().slice(0, 10));
    setVendasComPrejuizo(vendasPrejuizoResp?.vendas ?? []);
    setVendasIncompletasTotal(vendasIncompletasResp?.total ?? 0);
    setSaldoProjetado(saldoResp?.saldoProjetado ?? null);
    setAlertaConciliacao((conciliacaoResp?.linhas ?? []).filter((l) => l.alerta));

    setAtualizadoEm(new Date());
    setCarregando(false);
  }, [periodo]);

  useEffect(() => {
    if (podeVerFinanceiro) carregar();
  }, [podeVerFinanceiro, carregar]);

  const dadosCascata = useMemo(() => (resumoPeriodo ? construirDadosCascata(resumoPeriodo) : []), [resumoPeriodo]);

  if (carregandoSessao || !podeVerFinanceiro) {
    return (
      <div className="container mx-auto max-w-[1400px] space-y-8 p-6">
        <Skeleton className="h-[80px] rounded-md" />
      </div>
    );
  }

  const statItems: StatStripItem[] = [
    { label: "Faturamento bruto", value: formatBRL(resumoPeriodo?.faturamentoBruto ?? 0) },
    {
      label: "Margem de contribuição",
      value: resumoPeriodo?.margemContribuicaoPercentual != null
        ? formatPercent(resumoPeriodo.margemContribuicaoPercentual * 100)
        : "—",
    },
    { label: "Ticket médio", value: resumoPeriodo?.ticketMedio != null ? formatBRL(resumoPeriodo.ticketMedio) : "—" },
    { label: "Ads", value: formatBRL(resumoPeriodo?.ads ?? 0) },
    {
      label: "Falta vender no mês (p/ ponto de equilíbrio)",
      value:
        resumoPeriodo?.pontoEquilibrioMes.faltaVender != null
          ? formatBRL(resumoPeriodo.pontoEquilibrioMes.faltaVender)
          : "—",
      note: resumoPeriodo?.pontoEquilibrioMes.faltaVender === 0 ? "Meta do mês batida" : undefined,
    },
  ];

  return (
    <div className="container mx-auto max-w-[1400px] space-y-8 p-6">
      <PageHeader
        eyebrow="Financeiro"
        title="Visão geral"
        subtitle={atualizadoEm ? `Atualizado às ${atualizadoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : undefined}
        actions={<SeletorPeriodo valor={periodo} onChange={setPeriodo} />}
      />

      {(alertaConciliacao.length > 0 || vendasIncompletasTotal > 0) && (
        <SectionCard title="Alertas" contentClassName="space-y-2">
          {vendasIncompletasTotal > 0 && (
            <div className="flex items-center gap-2 text-sm text-warning">
              <AlertTriangle className="h-4 w-4" />
              {vendasIncompletasTotal} venda(s) incompleta(s) no período (sem custo, sem vínculo ou sem frete).{" "}
              <Link href={`/financeiro/vendas?soIncompletas=true`} className="underline">
                Ver vendas
              </Link>
            </div>
          )}
          {alertaConciliacao.map((linha) => (
            <div key={linha.tipo} className="flex items-center gap-2 text-sm text-warning">
              <AlertTriangle className="h-4 w-4" />
              Diferença de conciliação em {linha.tipo}: {formatBRL(linha.diferenca)}.{" "}
              <Link href="/financeiro/configuracoes" className="underline">
                Ver conciliação
              </Link>
            </div>
          ))}
        </SectionCard>
      )}

      <SectionCard title="Resumo de hoje" description="Comparado com ontem">
        {carregando && !resumoHoje ? (
          <Skeleton className="h-16 rounded-md" />
        ) : (
          <StatStrip
            items={[
              { label: "Faturamento", value: formatBRL(resumoHoje?.faturamentoBruto ?? 0), delta: resumoHoje?.comparacaoOntem.faturamentoBruto.percentual != null ? resumoHoje.comparacaoOntem.faturamentoBruto.percentual * 100 : null },
              { label: "Pedidos", value: String(resumoHoje?.pedidos ?? 0) },
              { label: "Margem de contribuição", value: formatBRL(resumoHoje?.margemContribuicao ?? 0) },
              { label: "Lucro estimado do dia", value: formatBRL(resumoHoje?.lucroEstimado ?? 0) },
            ]}
          />
        )}
      </SectionCard>

      {carregando && !resumoPeriodo ? (
        <Skeleton className="h-[124px] rounded-md" />
      ) : (
        <>
          <HeroMetric
            label="Lucro líquido do período"
            value={formatBRL(resumoPeriodo?.lucroLiquido ?? 0)}
            context="Margem de contribuição menos a parte proporcional das despesas fixas do mês."
          />
          <StatStrip items={statItems} />
        </>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Do faturamento ao lucro líquido" description="Período selecionado">
          {dadosCascata.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Sem dados no período.</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dadosCascata} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="nome" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis tickFormatter={(v) => formatBRL(v)} width={90} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(valor: number) => formatBRL(valor)} />
                <Bar dataKey="base" stackId="cascata" fill="transparent" />
                <Bar dataKey="altura" stackId="cascata">
                  {dadosCascata.map((ponto, index) => (
                    <Cell key={index} fill={ponto.positivo ? "hsl(var(--success))" : "hsl(var(--destructive))"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard title="Faturamento × margem de contribuição por dia">
          {serieDiaria.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Sem dados no período.</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={serieDiaria} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="dia" tickFormatter={(v) => formatDateBR(v)} tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => formatBRL(v)} width={90} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(valor: number) => formatBRL(valor)} labelFormatter={(v) => formatDateBR(v)} />
                <Line type="monotone" dataKey="faturamentoBruto" name="Faturamento" stroke={chartColor(0)} dot={false} />
                <Line type="monotone" dataKey="margemContribuicao" name="Margem" stroke={chartColor(1)} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Top 10 produtos por lucro">
          <TabelaProdutos produtos={topProdutos} />
        </SectionCard>
        <SectionCard title="10 produtos com pior margem">
          <TabelaProdutos produtos={piorProdutos} />
        </SectionCard>
      </div>

      <SectionCard
        title="Vendas com prejuízo no período"
        actions={
          <Link href="/financeiro/vendas?soPrejuizo=true" className="flex items-center gap-1 text-xs text-primary hover:underline">
            Ver todas<ArrowRight className="h-3 w-3" />
          </Link>
        }
      >
        {vendasComPrejuizo.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Nenhuma venda com prejuízo no período.</div>
        ) : (
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>Pedido</DataTableHead>
                <DataTableHead>Data</DataTableHead>
                <DataTableHead className="text-right">Margem</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {vendasComPrejuizo.map((venda) => (
                <DataTableRow key={venda.id}>
                  <DataTableCell>
                    <Link href={`/financeiro/vendas/${venda.id}`} className="text-primary hover:underline">
                      #{venda.pedidoExternoId}
                    </Link>
                  </DataTableCell>
                  <DataTableCell>{formatDateBR(venda.dataVenda)}</DataTableCell>
                  <DataTableCell numeric emphasis>
                    <StatusPill tone="critical">{formatBRL(venda.margemContribuicao ?? 0)}</StatusPill>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}
      </SectionCard>

      <SectionCard title="Contas a pagar e saldo projetado">
        <StatStrip
          items={[
            { label: "Vencendo hoje", value: formatBRL(resumoHoje?.contasAPagar.vencendoHoje.valor ?? 0), note: `${resumoHoje?.contasAPagar.vencendoHoje.quantidade ?? 0} conta(s)` },
            { label: "Vencidas", value: formatBRL(resumoHoje?.contasAPagar.vencidas.valor ?? 0), note: `${resumoHoje?.contasAPagar.vencidas.quantidade ?? 0} conta(s)` },
            { label: "Saldo projetado (30 dias)", value: saldoProjetado != null ? formatBRL(saldoProjetado) : "—" },
          ]}
        />
      </SectionCard>
    </div>
  );
}

function TabelaProdutos({ produtos }: { produtos: ProdutoLinha[] }) {
  if (produtos.length === 0) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Sem dados no período.</div>;
  }
  return (
    <DataTable>
      <DataTableHeader>
        <DataTableRow>
          <DataTableHead>Produto</DataTableHead>
          <DataTableHead className="text-right">Lucro líquido</DataTableHead>
          <DataTableHead className="text-right">Margem %</DataTableHead>
        </DataTableRow>
      </DataTableHeader>
      <DataTableBody>
        {produtos.map((produto) => (
          <DataTableRow key={produto.produtoId}>
            <DataTableCell>
              <Link href={`/produtos/${produto.produtoId}`} className="hover:underline">
                {produto.nome} <span className="text-muted-foreground">({produto.sku})</span>
              </Link>
            </DataTableCell>
            <DataTableCell numeric emphasis>{formatBRL(produto.lucroLiquido)}</DataTableCell>
            <DataTableCell numeric>
              {produto.margemContribuicaoPercentual != null ? formatPercent(produto.margemContribuicaoPercentual * 100) : "—"}
            </DataTableCell>
          </DataTableRow>
        ))}
      </DataTableBody>
    </DataTable>
  );
}
