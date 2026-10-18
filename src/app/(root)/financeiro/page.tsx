"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowRight, Info } from "lucide-react";
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
import { chartColor } from "@/lib/chart-colors";
import { SeletorPeriodo, periodoDoPreset, type PeriodoSelecionado } from "./components/SeletorPeriodo";
import { useAcessoFinanceiro } from "./components/useAcessoFinanceiro";
import { BotaoAtualizarFinanceiro } from "./components/BotaoAtualizarFinanceiro";
import { useAoAtualizarDados } from "./components/SincronizacaoFinanceira";
import { DemonstrativoResultado } from "./components/DemonstrativoResultado";
import {
  buscarJson,
  DESCRICAO_MODO_FATURAMENTO,
  moeda,
  percentual,
  variacao,
  type ComparacaoApi,
  type IndicadoresApi,
} from "./components/tipos";

interface ResumoPeriodoResponse {
  indicadores: IndicadoresApi;
  comparacaoPeriodoAnterior: ComparacaoApi;
  pontoEquilibrioMes: {
    despesasFixasDoMes: number;
    pontoEquilibrio: number | null;
    faturamentoDoMes: number;
    faltaVender: number | null;
    motivoIndisponivel: "SEM_DESPESAS_CADASTRADAS" | "MARGEM_NEGATIVA" | null;
  };
  metaMes: {
    metaFaturamentoMensal: number | null;
    percentualMeta: number | null;
    mesEmAndamento: boolean;
    projecaoFechamento: number;
  };
}

interface ResumoDiaResponse {
  indicadores: IndicadoresApi;
  comparacaoOntem: ComparacaoApi;
  comparacaoSemanaPassada: ComparacaoApi;
  contasAPagar: {
    vencendoHoje: { quantidade: number; valor: number };
    vencidas: { quantidade: number; valor: number };
    proximos7Dias: { quantidade: number; valor: number };
  };
  valorALiberarHoje: number;
}

interface PontoSerie {
  dia: string;
  faturamento: number;
  margemContribuicao: number;
  pedidos: number;
}

interface ResumoLogistica {
  logistica: string;
  rotulo: string;
  pedidos: number;
  faturamento: number;
  freteMedio: number | null;
  margemContribuicao: number;
  margemContribuicaoPercentual: number | null;
}

interface ProdutoLinha {
  produtoId: string;
  sku: string;
  nome: string;
  unidades: number;
  faturamentoBruto: number;
  margemContribuicao: number;
  margemContribuicaoPercentual: number | null;
}

interface VendaPrejuizo {
  id: string;
  pedidoExternoId: string;
  dataVenda: string;
  calculo: { margemContribuicao: number; receitaTotal: number };
  itens: Array<{ titulo: string }>;
}

interface ContaComSaldo {
  id: string;
  nome: string;
  tipo: string;
  saldoAtual: number;
  saldoALiberar: number | null;
  precisaAjuste: boolean;
  automatica: boolean;
}

interface LinhaConciliacao {
  tipo: string;
  alerta: boolean;
  diferenca: number;
  faturaDisponivel?: boolean;
}

function formatarDiaCurto(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
}

function formatarDataVenda(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function eixoMoeda(centavos: number): string {
  const reais = centavos / 100;
  if (Math.abs(reais) >= 1000) return `R$ ${(reais / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return `R$ ${reais.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

export default function FinanceiroPage() {
  const { carregando: carregandoSessao, podeVerFinanceiro } = useAcessoFinanceiro();
  const [periodo, setPeriodo] = useState<PeriodoSelecionado>({ preset: "mesAtual", ...periodoDoPreset("mesAtual") });
  const [carregando, setCarregando] = useState(true);

  const [resumoPeriodo, setResumoPeriodo] = useState<ResumoPeriodoResponse | null>(null);
  const [resumoHoje, setResumoHoje] = useState<ResumoDiaResponse | null>(null);
  const [serie, setSerie] = useState<PontoSerie[]>([]);
  const [porLogistica, setPorLogistica] = useState<ResumoLogistica[]>([]);
  const [produtos, setProdutos] = useState<ProdutoLinha[]>([]);
  const [vendasPrejuizo, setVendasPrejuizo] = useState<VendaPrejuizo[]>([]);
  const [contas, setContas] = useState<ContaComSaldo[]>([]);
  const [saldoProjetado, setSaldoProjetado] = useState<number | null>(null);
  const [conciliacao, setConciliacao] = useState<LinhaConciliacao[]>([]);
  const [vinculosPendentes, setVinculosPendentes] = useState(0);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const q = `desde=${periodo.desde.toISOString()}&ate=${periodo.ate.toISOString()}`;
    const mes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(
      periodo.ate < new Date() ? periodo.ate : new Date()
    );

    const [rp, rd, se, lo, pr, vp, ct, sp, co, vi] = await Promise.all([
      buscarJson<ResumoPeriodoResponse>(`/api/financeiro/resumo-periodo?${q}`),
      buscarJson<ResumoDiaResponse>("/api/financeiro/resumo-dia"),
      buscarJson<{ pontos: PontoSerie[] }>(`/api/financeiro/serie-diaria?${q}`),
      buscarJson<{ resumo: ResumoLogistica[] }>(`/api/financeiro/por-logistica?${q}`),
      buscarJson<{ produtos: ProdutoLinha[] }>(`/api/financeiro/produtos?${q}&ordenarPor=margemContribuicao&ordem=desc`),
      buscarJson<{ vendas: VendaPrejuizo[] }>(`/api/financeiro/vendas?${q}&soPrejuizo=true&porPagina=8`),
      buscarJson<{ contas: ContaComSaldo[] }>("/api/financeiro/contas-financeiras?comSaldo=true"),
      buscarJson<{ saldoProjetado: number }>("/api/financeiro/fluxo-caixa/saldo-projetado?dias=30"),
      buscarJson<{ linhas: LinhaConciliacao[] }>(`/api/financeiro/conciliacao?mes=${mes}`),
      buscarJson<{ vinculos: unknown[] }>("/api/produtos/vinculos-pendentes"),
    ]);

    setResumoPeriodo(rp);
    setResumoHoje(rd);
    setSerie(se?.pontos ?? []);
    setPorLogistica(lo?.resumo ?? []);
    setProdutos(pr?.produtos ?? []);
    setVendasPrejuizo(vp?.vendas ?? []);
    setContas(ct?.contas ?? []);
    setSaldoProjetado(sp?.saldoProjetado ?? null);
    setConciliacao((co?.linhas ?? []).filter((l) => l.alerta && l.faturaDisponivel !== false));
    setVinculosPendentes(vi?.vinculos.length ?? 0);
    setCarregando(false);
  }, [periodo]);

  useEffect(() => {
    if (podeVerFinanceiro) carregar();
  }, [podeVerFinanceiro, carregar]);

  useAoAtualizarDados(carregar);

  if (carregandoSessao || !podeVerFinanceiro) {
    return (
      <div className="container mx-auto max-w-[1400px] space-y-8 p-6">
        <Skeleton className="h-[80px] rounded-md" />
      </div>
    );
  }

  const ind = resumoPeriodo?.indicadores ?? null;
  const hoje = resumoHoje?.indicadores ?? null;
  const qualidade = ind?.qualidade;
  const carteiraMp = contas.find((c) => c.automatica && c.tipo === "CARTEIRA_MARKETPLACE");
  const melhores = produtos.slice(0, 8);
  const piores = [...produtos].sort((a, b) => a.margemContribuicao - b.margemContribuicao).slice(0, 8);

  const alertas: Array<{ texto: string; href?: string; acao?: string }> = [];
  if (qualidade && qualidade.vendasSemCusto > 0) {
    alertas.push({
      texto: `${qualidade.vendasSemCusto} venda(s) sem custo do produto (${moeda(qualidade.faturamentoSemCusto)} de faturamento) — o CMV e o lucro estão subestimados.`,
      href: "/financeiro/vendas?soIncompletas=true",
      acao: "Ver vendas",
    });
  }
  if (qualidade && qualidade.vendasSemVinculo > 0) {
    alertas.push({
      texto: `${qualidade.vendasSemVinculo} venda(s) de anúncios sem produto vinculado.`,
      href: "/financeiro/vendas?soIncompletas=true",
      acao: "Ver vendas",
    });
  }
  if (vinculosPendentes > 0) {
    alertas.push({
      texto: `${vinculosPendentes} vínculo(s) anúncio ↔ produto feitos por semelhança aguardando confirmação.`,
      href: "/produtos/vinculos-pendentes",
      acao: "Confirmar",
    });
  }
  for (const linha of conciliacao) {
    alertas.push({
      texto: `Fatura do ML e vendas divergem em ${linha.tipo === "FRETE" ? "frete" : "tarifas"}: ${moeda(linha.diferenca)}.`,
      href: "/financeiro/conferencia",
      acao: "Conferir",
    });
  }

  const pe = resumoPeriodo?.pontoEquilibrioMes;
  const meta = resumoPeriodo?.metaMes;
  const textoPontoEquilibrio = !pe
    ? "—"
    : pe.motivoIndisponivel === "SEM_DESPESAS_CADASTRADAS"
      ? "Cadastre as despesas fixas"
      : pe.motivoIndisponivel === "MARGEM_NEGATIVA"
        ? "Margem negativa"
        : pe.faltaVender === 0
          ? "Atingido"
          : moeda(pe.faltaVender);

  const indicadoresPeriodo: StatStripItem[] = ind
    ? [
        {
          label: "Pedidos",
          value: ind.pedidos.toLocaleString("pt-BR"),
          delta: variacao(resumoPeriodo?.comparacaoPeriodoAnterior.pedidos),
          note: `${ind.unidades.toLocaleString("pt-BR")} unidades`,
        },
        { label: "Ticket médio", value: moeda(ind.ticketMedio) },
        {
          label: "Margem de contribuição",
          value: moeda(ind.margemContribuicao),
          delta: variacao(resumoPeriodo?.comparacaoPeriodoAnterior.margemContribuicao),
          note: `${percentual(ind.margemContribuicaoPercentual)} do faturamento`,
        },
        {
          label: "Lucro líquido",
          value: moeda(ind.lucroLiquido),
          note:
            ind.totalDespesasOperacionais === 0
              ? "sem despesas cadastradas no período"
              : `${percentual(ind.lucroLiquidoPercentual)} · após ${moeda(ind.totalDespesasOperacionais)} de despesas`,
        },
        {
          label: "Custos do Mercado Livre",
          value: moeda(ind.custosVariaveis.tarifas + ind.custosVariaveis.frete + ind.custosVariaveis.ads + ind.custosVariaveis.armazenagemFull + ind.custosVariaveis.outrasCobrancas),
          note: `tarifas ${moeda(ind.custosVariaveis.tarifas)} · frete ${moeda(ind.custosVariaveis.frete)}`,
        },
        {
          label: "Líquido das vendas",
          value: moeda(ind.liquidoAReceber),
          note: "o que o ML repassa (após tarifas, frete e retenções)",
        },
      ]
    : [];

  return (
    <div className="container mx-auto max-w-[1400px] space-y-8 p-6">
      <PageHeader
        eyebrow="Financeiro"
        title="Visão geral"
        actions={
          <>
            <SeletorPeriodo valor={periodo} onChange={setPeriodo} />
            <BotaoAtualizarFinanceiro modo="INCREMENTAL" />
          </>
        }
      />

      {alertas.length > 0 && (
        <SectionCard title="Pontos de atenção" contentClassName="space-y-2">
          {alertas.map((alerta) => (
            <div key={alerta.texto} className="flex items-start gap-2 text-sm text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {alerta.texto}{" "}
                {alerta.href && (
                  <Link href={alerta.href} className="underline">
                    {alerta.acao}
                  </Link>
                )}
              </span>
            </div>
          ))}
        </SectionCard>
      )}

      {carregando && !ind ? (
        <Skeleton className="h-[124px] rounded-md" />
      ) : ind ? (
        <>
          <HeroMetric
            label="Faturamento do período"
            value={moeda(ind.receitaTotal)}
            delta={variacao(resumoPeriodo?.comparacaoPeriodoAnterior.faturamento)}
            deltaLabel="vs. período anterior"
            context={`${DESCRICAO_MODO_FATURAMENTO[ind.config.modoFaturamento].titulo}. ${
              ind.qualidade.vendasAguardandoDetalhes > 0
                ? `${ind.qualidade.vendasAguardandoDetalhes} venda(s) ainda recebendo tarifa e frete reais do Mercado Pago.`
                : "Tarifas e fretes confirmados pelo pagamento de cada venda."
            }`}
          />
          <StatStrip items={indicadoresPeriodo} />
        </>
      ) : (
        <SectionCard>
          <p className="py-6 text-center text-sm text-muted-foreground">Não foi possível carregar o resumo do período.</p>
        </SectionCard>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SectionCard title="Do faturamento ao lucro" description="Período selecionado · % sobre o faturamento">
          {ind ? <DemonstrativoResultado indicadores={ind} /> : <Skeleton className="h-64 rounded-md" />}
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Hoje" description="Comparado com ontem">
            {hoje ? (
              <StatStrip
                size="sm"
                items={[
                  {
                    label: "Faturamento",
                    value: moeda(hoje.receitaTotal),
                    delta: variacao(resumoHoje?.comparacaoOntem.faturamento),
                  },
                  { label: "Pedidos", value: String(hoje.pedidos), note: `${hoje.unidades} unidades` },
                  { label: "Margem de contribuição", value: moeda(hoje.margemContribuicao), note: percentual(hoje.margemContribuicaoPercentual) },
                  { label: "Liberado hoje no Mercado Pago", value: moeda(resumoHoje?.valorALiberarHoje ?? 0) },
                ]}
              />
            ) : (
              <Skeleton className="h-24 rounded-md" />
            )}
          </SectionCard>

          <SectionCard title="Fechamento do mês">
            <StatStrip
              size="sm"
              items={[
                {
                  label: meta?.mesEmAndamento ? "Projeção de fechamento" : "Faturamento do mês",
                  value: moeda(meta?.projecaoFechamento ?? null),
                  note: meta?.mesEmAndamento ? "pelo ritmo de vendas até hoje" : undefined,
                },
                {
                  label: "Meta do mês",
                  value: meta?.percentualMeta != null ? percentual(meta.percentualMeta) : "—",
                  note: meta?.metaFaturamentoMensal == null ? "defina em Configurações" : `de ${moeda(meta.metaFaturamentoMensal)}`,
                },
                {
                  label: "Falta para o ponto de equilíbrio",
                  value: textoPontoEquilibrio,
                  note:
                    pe && pe.pontoEquilibrio != null
                      ? `equilíbrio em ${moeda(pe.pontoEquilibrio)} (despesas fixas ${moeda(pe.despesasFixasDoMes)})`
                      : undefined,
                },
              ]}
            />
          </SectionCard>
        </div>
      </div>

      <SectionCard title="Faturamento e margem por dia">
        {serie.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Sem dados no período.</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={serie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="dia" tickFormatter={formatarDiaCurto} tick={{ fontSize: 11 }} minTickGap={16} />
              <YAxis tickFormatter={eixoMoeda} width={84} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(valor: number, nome: string) => [moeda(valor), nome]}
                labelFormatter={(v) => formatarDiaCurto(String(v))}
              />
              <Line type="monotone" dataKey="faturamento" name="Faturamento" stroke={chartColor(0)} dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="margemContribuicao" name="Margem de contribuição" stroke={chartColor(1)} dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Caixa" description="Saldo da carteira do Mercado Pago, liberações e contas">
          <StatStrip
            size="sm"
            items={[
              {
                label: carteiraMp?.nome ?? "Mercado Pago",
                value: carteiraMp ? moeda(carteiraMp.saldoAtual) : "—",
                note: carteiraMp?.precisaAjuste ? "informe o saldo atual em Fluxo de caixa" : "disponível agora",
              },
              { label: "A liberar (Mercado Pago)", value: moeda(carteiraMp?.saldoALiberar ?? 0), note: "vendas aguardando liberação" },
              {
                label: "Contas a pagar · 7 dias",
                value: moeda((resumoHoje?.contasAPagar.vencendoHoje.valor ?? 0) + (resumoHoje?.contasAPagar.proximos7Dias.valor ?? 0)),
                note:
                  resumoHoje && resumoHoje.contasAPagar.vencidas.quantidade > 0
                    ? `${resumoHoje.contasAPagar.vencidas.quantidade} vencida(s): ${moeda(resumoHoje.contasAPagar.vencidas.valor)}`
                    : "nenhuma vencida",
              },
              { label: "Saldo projetado em 30 dias", value: moeda(saldoProjetado) },
            ]}
          />
          {carteiraMp?.precisaAjuste && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5" />
              O Mercado Pago não informa o saldo para apps do Mercado Livre. Informe uma vez o saldo atual e o app passa a
              atualizá-lo sozinho com cada liberação.{" "}
              <Link href="/financeiro/fluxo-de-caixa" className="underline">
                Informar saldo
              </Link>
            </p>
          )}
        </SectionCard>

        <SectionCard title="Por logística">
          {porLogistica.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Sem vendas no período.</div>
          ) : (
            <DataTable>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHead>Logística</DataTableHead>
                  <DataTableHead className="text-right">Pedidos</DataTableHead>
                  <DataTableHead className="text-right">Faturamento</DataTableHead>
                  <DataTableHead className="text-right">Frete médio</DataTableHead>
                  <DataTableHead className="text-right">Margem</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {porLogistica.map((linha) => (
                  <DataTableRow key={linha.logistica}>
                    <DataTableCell>{linha.rotulo}</DataTableCell>
                    <DataTableCell numeric>{linha.pedidos}</DataTableCell>
                    <DataTableCell numeric>{moeda(linha.faturamento)}</DataTableCell>
                    <DataTableCell numeric>{moeda(linha.freteMedio)}</DataTableCell>
                    <DataTableCell numeric>
                      {moeda(linha.margemContribuicao)}{" "}
                      <span className="text-xs text-faint">{percentual(linha.margemContribuicaoPercentual)}</span>
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Produtos que mais dão margem"
          actions={
            <Link href="/financeiro/produtos" className="flex items-center gap-1 text-xs text-primary hover:underline">
              Ver todos<ArrowRight className="h-3 w-3" />
            </Link>
          }
        >
          <TabelaProdutos produtos={melhores} />
        </SectionCard>
        <SectionCard title="Produtos com menor margem">
          <TabelaProdutos produtos={piores} />
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
        {vendasPrejuizo.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Nenhuma venda com prejuízo no período.</div>
        ) : (
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>Pedido</DataTableHead>
                <DataTableHead>Produto</DataTableHead>
                <DataTableHead>Data</DataTableHead>
                <DataTableHead className="text-right">Valor</DataTableHead>
                <DataTableHead className="text-right">Margem</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {vendasPrejuizo.map((venda) => (
                <DataTableRow key={venda.id}>
                  <DataTableCell>
                    <Link href={`/financeiro/vendas?pedido=${venda.pedidoExternoId}`} className="text-primary hover:underline">
                      #{venda.pedidoExternoId}
                    </Link>
                  </DataTableCell>
                  <DataTableCell className="max-w-[280px] truncate">{venda.itens[0]?.titulo ?? "—"}</DataTableCell>
                  <DataTableCell>{formatarDataVenda(venda.dataVenda)}</DataTableCell>
                  <DataTableCell numeric>{moeda(venda.calculo.receitaTotal)}</DataTableCell>
                  <DataTableCell numeric emphasis>
                    <StatusPill tone="critical">{moeda(venda.calculo.margemContribuicao)}</StatusPill>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}
      </SectionCard>

      <p className="text-center text-xs text-faint">
        Os números do Financeiro usam a data de criação do pedido no fuso de Brasília — o mesmo critério do Mercado Livre.{" "}
        <Link href="/financeiro/conferencia" className="underline">
          Conferir com o Mercado Livre
        </Link>
      </p>
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
          <DataTableHead className="text-right">Unid.</DataTableHead>
          <DataTableHead className="text-right">Margem</DataTableHead>
          <DataTableHead className="text-right">%</DataTableHead>
        </DataTableRow>
      </DataTableHeader>
      <DataTableBody>
        {produtos.map((produto) => (
          <DataTableRow key={produto.produtoId}>
            <DataTableCell className="max-w-[280px]">
              <Link href={`/produtos/${produto.produtoId}`} className="block truncate hover:underline" title={produto.nome}>
                {produto.nome}
              </Link>
              <span className="text-xs text-faint">{produto.sku}</span>
            </DataTableCell>
            <DataTableCell numeric>{produto.unidades}</DataTableCell>
            <DataTableCell numeric emphasis>{moeda(produto.margemContribuicao)}</DataTableCell>
            <DataTableCell numeric>{percentual(produto.margemContribuicaoPercentual)}</DataTableCell>
          </DataTableRow>
        ))}
      </DataTableBody>
    </DataTable>
  );
}
