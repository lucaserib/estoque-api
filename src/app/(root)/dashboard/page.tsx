"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight, RefreshCw } from "lucide-react";
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
import PartialDataAlert from "@/components/dashboard/PartialDataAlert";
import EvolutionChart from "@/app/(root)/mercado-livre/vendas/components/EvolutionChart";
import { formatBRL, formatNumberBR, formatRelativeTime } from "@/lib/format";

const PERIOD_OPTIONS = [
  { value: "7", label: "7 dias" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
];

const PENDENCIA_CARDS: Array<{
  codigo: string;
  label: string;
  tone: "critical" | "warning";
}> = [
  { codigo: "SEM_CUSTO", label: "Sem custo", tone: "critical" },
  { codigo: "SEM_FORNECEDOR", label: "Sem fornecedor", tone: "critical" },
  { codigo: "SEM_PRECO", label: "Sem preço de venda", tone: "critical" },
  { codigo: "MARGEM_NEGATIVA", label: "Margem negativa", tone: "critical" },
  { codigo: "SEM_FRETE", label: "Sem custo de frete", tone: "warning" },
  { codigo: "SEM_TARIFA", label: "Sem tarifa calculada", tone: "warning" },
  {
    codigo: "ESTOQUE_DIVERGENTE",
    label: "Estoque divergente do Bling",
    tone: "warning",
  },
];

interface ResumoResponse {
  geradoEm: string;
  periodo: { dias: number };
  metricas: {
    faturamentoLiquido: {
      valor: number;
      parcial: boolean;
      deltaPercentual: number | null;
    };
    margemContribuicao: {
      valor: number;
      percentual: number;
      produtosSemCustoNaVenda: number;
    } | null;
    unidadesVendidas: number;
    ticketMedio: number;
    valorEstoqueCusto: { valor: number; produtosSemCusto: number } | null;
  };
  pendencias: {
    parcial: boolean;
    porCodigo: Record<string, number>;
    custoIndefinidoCount: number;
  };
  estoque: {
    parcial: boolean;
    topProdutos: Array<{
      produtoId: string;
      nome: string;
      estoqueLocal: number;
      fullDisponivel: number;
      fullEmTransito: number;
      aCaminho: number;
      valor: number | null;
    }>;
  };
  riscoRuptura: {
    parcial: boolean;
    itens: Array<{
      produtoId: string;
      nome: string;
      estoqueDisponivel: number;
      demandaDiaria: number;
      coberturaDias: number | null;
      quantidadeSugeridaCompraUnidades: number;
      custoTotalCompra: number | null;
      custoIndefinido: boolean;
      fornecedorPrincipalNome: string | null;
      status: "ok" | "atencao" | "critico";
    }>;
    semEstoque: number;
    rompeAntesDoProximoPedido: number;
  };
  capitalParado: {
    parcial: boolean;
    itens: Array<{
      produtoId: string;
      nome: string;
      estoqueLocal: number;
      valor: number | null;
    }>;
    valorTotal: number;
  };
  vendas: {
    parcial: boolean;
    serieDiaria: Array<{
      data: string;
      receita: number;
      unidades: number;
      pedidos: number;
    }>;
    topPorMargem: Array<{
      produtoId: string | null;
      nome: string;
      margem: number;
    }>;
  };
  compras: {
    parcial: boolean;
    totalAbertos: number;
    atrasados: number;
    valorAReceber: number;
  };
  integracoes: {
    parcial: boolean;
    bling: {
      isActive: boolean;
      ultimaSincronizacaoProdutos: string | null;
      ultimaSincronizacaoEstoque: string | null;
      webhooks24h: { total: number; comErro: number };
    } | null;
    mercadoLivre: {
      isActive: boolean;
      anunciosComErro: number;
    } | null;
  };
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [periodo, setPeriodo] = useState("30");
  const [resumo, setResumo] = useState<ResumoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);

  const podeVerCusto =
    session?.user?.role === "ADMIN" || session?.user?.role === "COMPRAS";

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/resumo?periodo=${periodo}`);
      if (res.ok) {
        setResumo(await res.json());
        setAtualizadoEm(new Date());
      }
    } catch (error) {
      console.error("Erro ao carregar o resumo do dashboard:", error);
    } finally {
      setLoading(false);
    }
  }, [periodo]);

  useEffect(() => {
    if (status === "authenticated") {
      carregar();
    }
  }, [status, carregar]);

  if (status === "loading" || (loading && !resumo)) {
    return (
      <div className="container mx-auto max-w-[1400px] space-y-8 p-6">
        <PageHeader title="Visão Geral" subtitle="Carregando seu negócio…" />
        <Skeleton className="h-[124px] rounded-md" />
        <Skeleton className="h-16 rounded-md" />
        <Skeleton className="h-[340px] rounded-md" />
      </div>
    );
  }

  const statItems: StatStripItem[] = [
    podeVerCusto && resumo?.metricas.margemContribuicao
      ? {
          label: "Margem de contribuição",
          value: `${formatBRL(resumo.metricas.margemContribuicao.valor)} (${resumo.metricas.margemContribuicao.percentual.toFixed(1)}%)`,
          note:
            resumo.metricas.margemContribuicao.produtosSemCustoNaVenda > 0
              ? `${resumo.metricas.margemContribuicao.produtosSemCustoNaVenda} venda(s) sem custo não entram`
              : undefined,
        }
      : null,
    {
      label: "Unidades vendidas",
      value: formatNumberBR(resumo?.metricas.unidadesVendidas ?? 0),
    },
    {
      label: "Ticket médio",
      value: formatBRL(resumo?.metricas.ticketMedio ?? 0),
    },
    podeVerCusto && resumo?.metricas.valorEstoqueCusto
      ? {
          label: "Valor em estoque (custo)",
          value: formatBRL(resumo.metricas.valorEstoqueCusto.valor),
          note:
            resumo.metricas.valorEstoqueCusto.produtosSemCusto > 0
              ? `${resumo.metricas.valorEstoqueCusto.produtosSemCusto} produto(s) sem custo não somados`
              : undefined,
        }
      : null,
  ].filter((item): item is StatStripItem => item !== null);

  return (
    <div className="container mx-auto max-w-[1400px] space-y-8 p-6">
      <PageHeader
        title="Visão Geral"
        subtitle={
          atualizadoEm
            ? `Atualizado às ${atualizadoEm.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}`
            : undefined
        }
        actions={
          <div className="flex items-center gap-2">
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-28 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={carregar}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        }
      />

      {!resumo ? (
        <Skeleton className="h-[340px] rounded-md" />
      ) : (
        <>
          {resumo.metricas.faturamentoLiquido.parcial && (
            <PartialDataAlert onRetry={carregar} retrying={loading} />
          )}

          {/* Métricas principais */}
          <HeroMetric
            label={`Faturamento líquido — ${periodo} dias`}
            value={formatBRL(resumo.metricas.faturamentoLiquido.valor)}
            delta={resumo.metricas.faturamentoLiquido.deltaPercentual}
            deltaLabel={`vs ${periodo}d anteriores`}
            context="Vendas pagas no Mercado Livre, menos tarifas de venda e frete pago pelo vendedor."
          />

          <StatStrip items={statItems} />

          {/* Pendências que afetam seus números */}
          {podeVerCusto && (
            <SectionCard title="Pendências que afetam seus números">
              {Object.keys(resumo.pendencias.porCodigo).length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Cadastro completo — nenhuma pendência encontrada.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {PENDENCIA_CARDS.filter(
                    (card) => resumo.pendencias.porCodigo[card.codigo] > 0
                  ).map((card) => (
                    <Link
                      key={card.codigo}
                      href={`/produtos?pendencia=${card.codigo}`}
                      className="rounded-lg border border-border p-3 transition hover:border-primary/50 hover:bg-accent/40"
                    >
                      <div className="flex items-center justify-between">
                        <StatusPill tone={card.tone}>
                          {resumo.pendencias.porCodigo[card.codigo]}
                        </StatusPill>
                      </div>
                      <p className="mt-2 text-sm font-medium">{card.label}</p>
                    </Link>
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {/* Onde está o estoque */}
          <SectionCard
            title="Onde está o estoque"
            description="Top 10 produtos por estoque total"
          >
            <DataTable>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHead>Produto</DataTableHead>
                  <DataTableHead className="text-right">Local</DataTableHead>
                  <DataTableHead className="text-right">Full disp.</DataTableHead>
                  <DataTableHead className="text-right">Full em trânsito</DataTableHead>
                  <DataTableHead className="text-right">A caminho</DataTableHead>
                  {podeVerCusto && (
                    <DataTableHead className="text-right">Valor</DataTableHead>
                  )}
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {resumo.estoque.topProdutos.length === 0 ? (
                  <DataTableRow>
                    <DataTableCell colSpan={podeVerCusto ? 6 : 5} className="text-center text-muted-foreground py-6">
                      Nenhum produto com estoque cadastrado.
                    </DataTableCell>
                  </DataTableRow>
                ) : (
                  resumo.estoque.topProdutos.map((item) => (
                    <DataTableRow key={item.produtoId}>
                      <DataTableCell className="max-w-[220px] truncate">
                        <Link href={`/produtos/${item.produtoId}`} className="hover:underline">
                          {item.nome}
                        </Link>
                      </DataTableCell>
                      <DataTableCell className="text-right">{item.estoqueLocal}</DataTableCell>
                      <DataTableCell className="text-right">{item.fullDisponivel}</DataTableCell>
                      <DataTableCell className="text-right">{item.fullEmTransito}</DataTableCell>
                      <DataTableCell className="text-right">{item.aCaminho}</DataTableCell>
                      {podeVerCusto && (
                        <DataTableCell className="text-right">
                          {item.valor != null ? formatBRL(item.valor) : "—"}
                        </DataTableCell>
                      )}
                    </DataTableRow>
                  ))
                )}
              </DataTableBody>
            </DataTable>
          </SectionCard>

          {/* Risco de ruptura */}
          <SectionCard
            title="Risco de ruptura"
            description={`${resumo.riscoRuptura.semEstoque} já sem estoque · ${resumo.riscoRuptura.rompeAntesDoProximoPedido} rompe antes do próximo pedido`}
            actions={
              <Link
                href="/reposicao"
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Ver todos
                <ArrowRight className="h-3 w-3" />
              </Link>
            }
          >
            <DataTable>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHead>Produto</DataTableHead>
                  <DataTableHead className="text-right">Disponível</DataTableHead>
                  <DataTableHead className="text-right">Vendas/dia</DataTableHead>
                  <DataTableHead className="text-right">Dias restantes</DataTableHead>
                  <DataTableHead className="text-right">Sugestão</DataTableHead>
                  {podeVerCusto && <DataTableHead className="text-right">Valor</DataTableHead>}
                  <DataTableHead>Fornecedor</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {resumo.riscoRuptura.itens.length === 0 ? (
                  <DataTableRow>
                    <DataTableCell colSpan={podeVerCusto ? 7 : 6} className="text-center text-muted-foreground py-6">
                      Nenhum produto em risco de ruptura.
                    </DataTableCell>
                  </DataTableRow>
                ) : (
                  resumo.riscoRuptura.itens.map((item) => (
                    <DataTableRow key={item.produtoId}>
                      <DataTableCell className="max-w-[200px] truncate">
                        <Link href={`/produtos/${item.produtoId}`} className="hover:underline">
                          {item.nome}
                        </Link>
                      </DataTableCell>
                      <DataTableCell className="text-right">{item.estoqueDisponivel}</DataTableCell>
                      <DataTableCell className="text-right">{item.demandaDiaria.toFixed(1)}</DataTableCell>
                      <DataTableCell className="text-right">
                        {item.coberturaDias != null ? item.coberturaDias.toFixed(0) : "—"}
                      </DataTableCell>
                      <DataTableCell className="text-right">
                        {item.quantidadeSugeridaCompraUnidades}
                      </DataTableCell>
                      {podeVerCusto && (
                        <DataTableCell className="text-right">
                          {item.custoIndefinido || item.custoTotalCompra == null
                            ? "—"
                            : formatBRL(item.custoTotalCompra)}
                        </DataTableCell>
                      )}
                      <DataTableCell>
                        <div className="flex items-center gap-2">
                          <StatusPill
                            tone={item.status === "critico" ? "critical" : "warning"}
                          >
                            {item.status === "critico" ? "Crítico" : "Atenção"}
                          </StatusPill>
                          <span className="text-xs text-muted-foreground truncate">
                            {item.fornecedorPrincipalNome ?? "Sem fornecedor"}
                          </span>
                        </div>
                      </DataTableCell>
                    </DataTableRow>
                  ))
                )}
              </DataTableBody>
            </DataTable>
          </SectionCard>

          {/* Capital parado */}
          {podeVerCusto && resumo.capitalParado.itens.length > 0 && (
            <SectionCard
              title="Capital parado"
              description="Produtos sem venda recente e cobertura acima de 120 dias"
            >
              <div className="mb-3 text-sm">
                <span className="font-semibold">{formatBRL(resumo.capitalParado.valorTotal)}</span>{" "}
                <span className="text-muted-foreground">parados em {resumo.capitalParado.itens.length} produto(s)</span>
              </div>
              <DataTable>
                <DataTableHeader>
                  <DataTableRow>
                    <DataTableHead>Produto</DataTableHead>
                    <DataTableHead className="text-right">Estoque local</DataTableHead>
                    <DataTableHead className="text-right">Valor</DataTableHead>
                  </DataTableRow>
                </DataTableHeader>
                <DataTableBody>
                  {resumo.capitalParado.itens.slice(0, 10).map((item) => (
                    <DataTableRow key={item.produtoId}>
                      <DataTableCell className="max-w-[260px] truncate">
                        <Link href={`/produtos/${item.produtoId}`} className="hover:underline">
                          {item.nome}
                        </Link>
                      </DataTableCell>
                      <DataTableCell className="text-right">{item.estoqueLocal}</DataTableCell>
                      <DataTableCell className="text-right">
                        {item.valor != null ? formatBRL(item.valor) : "—"}
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </SectionCard>
          )}

          {/* Vendas */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <SectionCard title="Evolução de vendas" className="lg:col-span-2">
              <EvolutionChart
                data={resumo.vendas.serieDiaria.map((d) => ({
                  date: d.data,
                  revenue: d.receita,
                  items: d.unidades,
                  orders: d.pedidos,
                }))}
                bare
              />
            </SectionCard>

            {podeVerCusto && (
              <SectionCard title="Top produtos por margem">
                {resumo.vendas.topPorMargem.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    Nenhuma venda com custo conhecido no período.
                  </div>
                ) : (
                  <ul className="space-y-2.5">
                    {resumo.vendas.topPorMargem.slice(0, 8).map((item) => (
                      <li
                        key={item.produtoId ?? item.nome}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="text-sm truncate">{item.nome}</span>
                        <span className="text-sm font-medium shrink-0">
                          {formatBRL(item.margem)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            )}
          </div>

          {/* Compras */}
          <SectionCard title="Compras">
            <StatStrip
              items={[
                {
                  label: "Pedidos em aberto",
                  value: formatNumberBR(resumo.compras.totalAbertos),
                },
                {
                  label: "Atrasados",
                  value: formatNumberBR(resumo.compras.atrasados),
                },
                ...(podeVerCusto
                  ? [
                      {
                        label: "Valor a receber",
                        value: formatBRL(resumo.compras.valorAReceber),
                      },
                    ]
                  : []),
              ]}
            />
          </SectionCard>

          {/* Saúde das integrações */}
          <SectionCard title="Saúde das integrações">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">Bling</p>
                  {resumo.integracoes.bling ? (
                    <StatusPill tone={resumo.integracoes.bling.isActive ? "success" : "critical"}>
                      {resumo.integracoes.bling.isActive ? "Conectado" : "Reconexão necessária"}
                    </StatusPill>
                  ) : (
                    <StatusPill tone="neutral">Desconectado</StatusPill>
                  )}
                </div>
                {resumo.integracoes.bling ? (
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <p>
                      Produtos:{" "}
                      {resumo.integracoes.bling.ultimaSincronizacaoProdutos
                        ? formatRelativeTime(resumo.integracoes.bling.ultimaSincronizacaoProdutos)
                        : "nunca"}
                    </p>
                    <p>
                      Estoque:{" "}
                      {resumo.integracoes.bling.ultimaSincronizacaoEstoque
                        ? formatRelativeTime(resumo.integracoes.bling.ultimaSincronizacaoEstoque)
                        : "nunca"}
                    </p>
                    <p>
                      Webhooks (24h): {resumo.integracoes.bling.webhooks24h.total}
                      {resumo.integracoes.bling.webhooks24h.comErro > 0 && (
                        <span className="text-destructive">
                          {" "}
                          ({resumo.integracoes.bling.webhooks24h.comErro} com erro)
                        </span>
                      )}
                    </p>
                  </div>
                ) : (
                  <Link
                    href="/integracoes"
                    className="mt-3 inline-block text-xs text-primary hover:underline"
                  >
                    Conectar Bling
                  </Link>
                )}
              </div>

              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">Mercado Livre</p>
                  {resumo.integracoes.mercadoLivre ? (
                    <StatusPill tone={resumo.integracoes.mercadoLivre.isActive ? "success" : "critical"}>
                      {resumo.integracoes.mercadoLivre.isActive ? "Conectado" : "Reconexão necessária"}
                    </StatusPill>
                  ) : (
                    <StatusPill tone="neutral">Desconectado</StatusPill>
                  )}
                </div>
                {resumo.integracoes.mercadoLivre ? (
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <p>
                      Anúncios com erro de sincronização:{" "}
                      {resumo.integracoes.mercadoLivre.anunciosComErro}
                    </p>
                  </div>
                ) : (
                  <Link
                    href="/integracoes"
                    className="mt-3 inline-block text-xs text-primary hover:underline"
                  >
                    Conectar Mercado Livre
                  </Link>
                )}
              </div>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
