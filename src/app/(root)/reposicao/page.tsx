"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  RefreshCw,
  AlertCircle,
  Search,
  Package,
  TrendingDown,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { HeroMetric } from "@/components/ui/hero-metric";
import { StatStrip, type StatStripItem } from "@/components/ui/stat-strip";
import { SectionCard } from "@/components/ui/section-card";
import {
  DataTable,
  DataTableBody,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";
import { ReplenishmentTableRow } from "./components/ReplenishmentTableRow";
import { ReplenishmentDetailModal } from "./components/ReplenishmentDetailModal";

interface BatchAnalysisResult {
  produtoId: string;
  produtoNome: string;
  sku: string;
  custoMedio: number;
  tipoAnuncio: "full" | "local" | "ambos";
  estoqueLocal: number;
  estoqueFull: number;
  estoqueTotal: number;
  mediaVendasPeriodo: number;
  mediaDiaria: number;
  analysisPeriodDays: number;
  statusGeral: "ok" | "atencao" | "critico";
  reposicaoFull: {
    necessaria: boolean;
    quantidadeSugerida: number;
    diasRestantes: number;
    status: "ok" | "atencao" | "critico";
    custoTotal: number;
  } | null;
  reposicaoLocal: {
    necessaria: boolean;
    quantidadeSugerida: number;
    diasRestantes: number;
    status: "ok" | "atencao" | "critico";
    custoTotal: number;
  };
  custoTotalReposicao: number;
  custoIndefinido: boolean;
}

interface BatchAnalysisResponse {
  success: boolean;
  results: BatchAnalysisResult[];
  summary: {
    total: number;
    critico: number;
    atencao: number;
    ok: number;
    custoTotalCritico: number;
    custoTotalAtencao: number;
    custoTotalGeral: number;
  };
  parcial?: boolean;
}

const ReposicaoPage = () => {
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedProdutoId, setSelectedProdutoId] = useState<string | null>(
    null
  );
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const [analysisData, setAnalysisData] = useState<BatchAnalysisResponse | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/replenishment/batch-analysis");
      if (!response.ok) {
        throw new Error("Erro ao buscar análise");
      }
      const data = await response.json();
      setAnalysisData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      console.error("Erro ao buscar análise:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const refetch = fetchData;

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      await refetch();
      toast.success("Análise de reposição atualizada!");
    } catch (error) {
      toast.error("Erro ao analisar produtos");
      console.error("Erro na análise:", error);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleViewDetails = (produtoId: string) => {
    setSelectedProdutoId(produtoId);
    setShowDetailsModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailsModal(false);
    setSelectedProdutoId(null);
  };

  const handleConfigUpdated = () => {
    // Recarregar análise após atualização de configuração
    refetch();
  };

  const [gerandoPedidos, setGerandoPedidos] = useState(false);

  const handleGerarPedidos = async () => {
    setGerandoPedidos(true);
    try {
      const response = await fetch("/api/replenishment/gerar-pedidos", {
        method: "POST",
      });
      if (!response.ok) throw new Error();
      const data = await response.json();

      if (data.pedidosCriados === 0) {
        toast.info("Nenhum pedido criado: nenhum item com fornecedor principal precisa de compra.");
      } else {
        toast.success(
          `${data.pedidosCriados} pedido(s) de compra gerado(s) como rascunho.` +
            (data.itensIgnoradosSemFornecedor > 0
              ? ` ${data.itensIgnoradosSemFornecedor} item(ns) sem fornecedor principal foram ignorados.`
              : "")
        );
      }
    } catch {
      toast.error("Erro ao gerar pedidos de compra");
    } finally {
      setGerandoPedidos(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const statItems: StatStripItem[] = analysisData
    ? [
        { label: "Produtos em alerta", value: String(analysisData.summary.total) },
        { label: "Críticos", value: String(analysisData.summary.critico) },
        { label: "Atenção", value: String(analysisData.summary.atencao) },
      ]
    : [];

  return (
    <div className="container mx-auto max-w-[1400px] space-y-8 p-6">
      <PageHeader
        title="Reposição"
        subtitle="Produtos que precisam de reposição urgente"
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleGerarPedidos}
              disabled={
                gerandoPedidos || !analysisData || analysisData.results.length === 0
              }
              className="gap-2"
            >
              {gerandoPedidos ? "Gerando..." : "Gerar pedidos de compra"}
            </Button>
            <Button onClick={handleAnalyze} disabled={analyzing || loading} className="gap-2">
              {analyzing || loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Verificar Estoque
                </>
              )}
            </Button>
          </div>
        }
      />

      <Alert className="border-info/30 bg-info/10">
        <AlertCircle className="h-4 w-4 text-info" />
        <AlertDescription className="text-sm text-info">
          <strong>Importante:</strong> Esta análise considera as configurações
          de reposição de cada produto. Para ajustar os parâmetros, acesse a
          página de Produtos e clique em "Ver Reposição" no produto desejado.
        </AlertDescription>
      </Alert>

      {/* Loading State */}
      {loading && !analysisData && (
        <>
          <Skeleton className="h-[124px] rounded-md" />
          <Skeleton className="h-16 rounded-md" />
          <Skeleton className="h-96 rounded-md" />
        </>
      )}

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Erro ao carregar análise de reposição. Tente novamente.
          </AlertDescription>
        </Alert>
      )}

      {/* Success State - Com Dados */}
      {analysisData?.parcial && !loading && (
        <Alert variant="warning">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Alguns pedidos do Mercado Livre não puderam ser carregados. A
            demanda calculada pode estar incompleta.
          </AlertDescription>
        </Alert>
      )}

      {analysisData && !loading && analysisData.summary && (
        <>
          <HeroMetric
            label="Custo total para reposição completa"
            value={formatCurrency(analysisData.summary.custoTotalGeral)}
            context={
              analysisData.results.some((r) => r.custoIndefinido)
                ? `Investimento estimado. ${
                    analysisData.results.filter((r) => r.custoIndefinido).length
                  } item(ns) sem custo não somados ao total.`
                : "Investimento estimado para repor todos os produtos em alerta ao nível ideal."
            }
          />

          <StatStrip items={statItems} />

          <SectionCard
            title="Produtos"
            contentClassName={
              (analysisData?.results?.length || 0) === 0 ? undefined : "p-0"
            }
          >
            {(analysisData?.results?.length || 0) === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="h-16 w-16 bg-success/10 rounded-full flex items-center justify-center mb-4">
                  <Package className="h-8 w-8 text-success" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Nenhum produto precisa de reposição
                </h3>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  Todos os produtos estão com estoque adequado. Clique em
                  "Verificar Estoque" para atualizar a análise.
                </p>
              </div>
            ) : (
              <DataTable>
                <DataTableHeader>
                  <DataTableRow className="hover:bg-transparent">
                    <DataTableHead className="pl-4">Status</DataTableHead>
                    <DataTableHead sticky>Produto</DataTableHead>
                    <DataTableHead>Tipo</DataTableHead>
                    <DataTableHead className="text-right">
                      Estoque Local
                    </DataTableHead>
                    <DataTableHead className="text-right">
                      Estoque Full
                    </DataTableHead>
                    <DataTableHead className="text-right">
                      Dias Rest.
                    </DataTableHead>
                    <DataTableHead className="text-right">
                      Média/Dia
                    </DataTableHead>
                    <DataTableHead className="text-right">
                      Repor Full
                    </DataTableHead>
                    <DataTableHead className="text-right">
                      Comprar
                    </DataTableHead>
                    <DataTableHead className="text-right">
                      Custo Total
                    </DataTableHead>
                    <DataTableHead className="pr-4">Ações</DataTableHead>
                  </DataTableRow>
                </DataTableHeader>
                <DataTableBody>
                  {analysisData?.results?.map((item) => (
                    <ReplenishmentTableRow
                      key={item.produtoId}
                      item={item}
                      onViewDetails={handleViewDetails}
                    />
                  ))}
                </DataTableBody>
              </DataTable>
            )}
          </SectionCard>

          {/* Rodapé com estatísticas */}
          {(analysisData?.results?.length || 0) > 0 && (
            <div className="flex items-center justify-between p-4 bg-background rounded-md border border-border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingDown className="h-4 w-4" />
                <span>
                  Exibindo {analysisData?.results?.length || 0} produto(s) que
                  precisam de atenção
                </span>
              </div>
              <div className="text-sm font-medium text-foreground">
                Investimento necessário:{" "}
                {formatCurrency(analysisData?.summary?.custoTotalGeral || 0)}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal de Detalhes */}
      {selectedProdutoId && (
        <ReplenishmentDetailModal
          produtoId={selectedProdutoId}
          isOpen={showDetailsModal}
          onClose={handleCloseModal}
          onConfigUpdated={handleConfigUpdated}
        />
      )}
    </div>
  );
};

export default ReposicaoPage;
