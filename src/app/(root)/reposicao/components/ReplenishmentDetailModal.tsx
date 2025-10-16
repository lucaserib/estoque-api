"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  TrendingUp,
  Save,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ShoppingCart,
  Truck,
  Package,
  DollarSign,
  Calendar,
  TrendingDown,
  Clock,
  Box,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ReplenishmentDetailModalProps {
  produtoId: string;
  isOpen: boolean;
  onClose: () => void;
  onConfigUpdated?: () => void;
}

interface ReplenishmentConfig {
  avgDeliveryDays: number;
  fullReleaseDays: number;
  safetyStock: number;
  minCoverageDays: number;
  analysisPeriodDays: number;
}

interface ReplenishmentSuggestion {
  tipoAnuncio: "full" | "local" | "ambos";
  estoqueLocal: number;
  estoqueFull: number;
  estoqueTotal: number;
  mediaVendas90d: number;
  mediaDiaria: number;
  reposicaoFull: {
    necessaria: boolean;
    pontoReposicao: number;
    diasRestantes: number;
    quantidadeSugerida: number;
    temEstoqueLocal: boolean;
    status: "ok" | "atencao" | "critico";
    mensagem: string;
    acaoRecomendada: "transferir" | "aguardar_compra" | "nenhuma";
  } | null;
  reposicaoLocal: {
    necessaria: boolean;
    pontoReposicao: number;
    diasRestantes: number;
    quantidadeSugerida: number;
    quantidadeParaFull: number;
    quantidadeParaLocal: number;
    status: "ok" | "atencao" | "critico";
    mensagem: string;
    acaoRecomendada: "comprar" | "nenhuma";
  };
  acoesPrioritarias: Array<{
    tipo: "transferir_full" | "comprar_local";
    quantidade: number;
    origem: string;
    destino: string;
    prazo: string;
    prioridade: "alta" | "media" | "baixa";
  }>;
  statusGeral: "ok" | "atencao" | "critico";
}

interface ProdutoDetalhes {
  id: string;
  nome: string;
  sku: string;
  custoMedio: number;
  estoques: Array<{
    quantidade: number;
    armazem: {
      nome: string;
    };
  }>;
}

export function ReplenishmentDetailModal({
  produtoId,
  isOpen,
  onClose,
  onConfigUpdated,
}: ReplenishmentDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [calculando, setCalculando] = useState(false);
  const [produto, setProduto] = useState<ProdutoDetalhes | null>(null);
  const [config, setConfig] = useState<ReplenishmentConfig>({
    avgDeliveryDays: 7,
    fullReleaseDays: 3,
    safetyStock: 10,
    minCoverageDays: 30,
    analysisPeriodDays: 90,
  });
  const [sugestao, setSugestao] = useState<ReplenishmentSuggestion | null>(null);

  useEffect(() => {
    if (isOpen && produtoId) {
      buscarDadosProduto();
      buscarConfiguracao();
      calcularSugestao();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, produtoId]);

  const buscarDadosProduto = async () => {
    try {
      const response = await fetch(`/api/produtos/${produtoId}`);
      if (response.ok) {
        const data = await response.json();
        setProduto(data);
      }
    } catch (error) {
      console.error("Erro ao buscar produto:", error);
    }
  };

  const buscarConfiguracao = async () => {
    try {
      const response = await fetch(
        `/api/replenishment/config?produtoId=${produtoId}`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.config && !data.isGlobal) {
          setConfig({
            avgDeliveryDays: data.config.avgDeliveryDays,
            fullReleaseDays: data.config.fullReleaseDays,
            safetyStock: data.config.safetyStock,
            minCoverageDays: data.config.minCoverageDays || 30,
            analysisPeriodDays: data.config.analysisPeriodDays || 90,
          });
        }
      }
    } catch (error) {
      console.error("Erro ao buscar configuração:", error);
    }
  };

  const calcularSugestao = async () => {
    setCalculando(true);
    try {
      const response = await fetch(
        `/api/replenishment/suggestions/${produtoId}`
      );
      if (response.ok) {
        const data = await response.json();
        setSugestao(data.suggestion);
      }
    } catch (error) {
      console.error("Erro ao calcular sugestão:", error);
    } finally {
      setCalculando(false);
    }
  };

  const handleSalvar = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/replenishment/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          produtoId,
          ...config,
        }),
      });

      if (response.ok) {
        toast.success("Configuração salva com sucesso!");
        await calcularSugestao();
        onConfigUpdated?.();
      } else {
        throw new Error("Erro ao salvar configuração");
      }
    } catch (error) {
      toast.error("Não foi possível salvar a configuração.");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value / 100);
  };

  const getStatusBadge = (status: "ok" | "atencao" | "critico") => {
    switch (status) {
      case "critico":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Crítico
          </Badge>
        );
      case "atencao":
        return (
          <Badge className="gap-1 bg-yellow-500 hover:bg-yellow-600 text-white">
            <AlertTriangle className="h-3 w-3" />
            Atenção
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
            <CheckCircle className="h-3 w-3" />
            OK
          </Badge>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0 gap-0 bg-white/95 dark:bg-gray-900/95 border border-gray-200 dark:border-gray-700 shadow-xl rounded-xl backdrop-blur-md">
        <div className="sticky top-0 z-10 backdrop-blur-md bg-white/90 dark:bg-gray-900/90 border-b border-gray-200 dark:border-gray-800 rounded-t-xl">
          <DialogHeader className="p-6 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2 text-xl font-bold text-gray-800 dark:text-gray-100">
                  <Package className="h-5 w-5 text-purple-500" />
                  Análise Detalhada de Reposição
                </DialogTitle>
                <DialogDescription className="text-gray-600 dark:text-gray-400 mt-2">
                  {produto && (
                    <>
                      <span className="font-semibold text-gray-800 dark:text-gray-200">
                        {produto.nome}
                      </span>
                      <br />
                      SKU: {produto.sku} • Custo: {formatCurrency(produto.custoMedio)}
                    </>
                  )}
                </DialogDescription>
              </div>
              {sugestao && getStatusBadge(sugestao.statusGeral)}
            </div>
          </DialogHeader>
        </div>

        <div className="p-6">
          <Tabs defaultValue="analise" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="analise">📊 Análise</TabsTrigger>
              <TabsTrigger value="configuracao">⚙️ Configuração</TabsTrigger>
              <TabsTrigger value="detalhes">📦 Detalhes</TabsTrigger>
            </TabsList>

            {/* ABA: ANÁLISE */}
            <TabsContent value="analise" className="space-y-6">
              {calculando ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                  <span className="ml-3 text-gray-600 dark:text-gray-400">
                    Calculando sugestões...
                  </span>
                </div>
              ) : sugestao ? (
                <div className="space-y-6">
                  {/* Cards de Estoque */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          Estoque Local
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                            {sugestao.estoqueLocal}
                          </span>
                          <Box className="h-8 w-8 text-gray-400" />
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          {sugestao.reposicaoLocal.diasRestantes > 999
                            ? "Estoque ilimitado"
                            : `${sugestao.reposicaoLocal.diasRestantes} dias restantes`}
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          Estoque Full
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                            {sugestao.estoqueFull}
                          </span>
                          <Truck className="h-8 w-8 text-blue-400" />
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          {sugestao.reposicaoFull
                            ? sugestao.reposicaoFull.diasRestantes > 999
                              ? "Estoque ilimitado"
                              : `${sugestao.reposicaoFull.diasRestantes} dias restantes`
                            : "Não aplicável"}
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          Média Diária
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                            {sugestao.mediaDiaria.toFixed(1)}
                          </span>
                          <TrendingUp className="h-8 w-8 text-purple-400" />
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          {sugestao.mediaVendas90d} vendas ({config.analysisPeriodDays}d)
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Ações Prioritárias */}
                  {sugestao.acoesPrioritarias.length > 0 && (
                    <Card className="border-purple-200 dark:border-purple-800">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <AlertCircle className="h-5 w-5 text-purple-600" />
                          Ações Recomendadas
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {sugestao.acoesPrioritarias.map((acao, index) => (
                          <div
                            key={index}
                            className={`flex items-center justify-between p-4 rounded-lg border-2 ${
                              acao.prioridade === "alta"
                                ? "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800"
                                : acao.prioridade === "media"
                                ? "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-300 dark:border-yellow-800"
                                : "bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-800"
                            }`}
                          >
                            <div className="flex items-center gap-4 flex-1">
                              <div
                                className={`flex items-center justify-center w-10 h-10 rounded-full font-bold text-lg ${
                                  acao.prioridade === "alta"
                                    ? "bg-red-500 text-white"
                                    : acao.prioridade === "media"
                                    ? "bg-yellow-500 text-white"
                                    : "bg-green-500 text-white"
                                }`}
                              >
                                {index + 1}
                              </div>
                              <div className="flex-1">
                                <p className="font-semibold text-gray-900 dark:text-gray-100">
                                  {acao.tipo === "transferir_full" ? (
                                    <>
                                      <Truck className="inline h-4 w-4 mr-1" />
                                      Transferir {acao.quantidade} unidades para Full
                                    </>
                                  ) : (
                                    <>
                                      <ShoppingCart className="inline h-4 w-4 mr-1" />
                                      Comprar {acao.quantidade} unidades do fornecedor
                                    </>
                                  )}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                  {acao.origem} → {acao.destino}
                                </p>
                                <div className="flex items-center gap-3 mt-2">
                                  <span className="flex items-center gap-1 text-xs text-gray-500">
                                    <Clock className="h-3 w-3" />
                                    Prazo: {acao.prazo}
                                  </span>
                                  <span className="flex items-center gap-1 text-xs text-gray-500">
                                    <DollarSign className="h-3 w-3" />
                                    Custo: {formatCurrency((acao.quantidade * (produto?.custoMedio || 0)))}
                                  </span>
                                </div>
                              </div>
                              <Badge
                                variant={
                                  acao.prioridade === "alta"
                                    ? "destructive"
                                    : acao.prioridade === "media"
                                    ? "default"
                                    : "outline"
                                }
                                className={
                                  acao.prioridade === "media"
                                    ? "bg-yellow-500 hover:bg-yellow-600 text-white"
                                    : ""
                                }
                              >
                                {acao.prioridade === "alta"
                                  ? "Urgente"
                                  : acao.prioridade === "media"
                                  ? "Importante"
                                  : "Normal"}
                              </Badge>
                            </div>
                            <Button
                              size="sm"
                              className={`ml-3 ${
                                acao.tipo === "transferir_full"
                                  ? "bg-blue-600 hover:bg-blue-700"
                                  : "bg-orange-600 hover:bg-orange-700"
                              } text-white`}
                              onClick={() => {
                                toast.info("Funcionalidade em desenvolvimento");
                              }}
                            >
                              {acao.tipo === "transferir_full" ? "Transferir" : "Gerar Pedido"}
                            </Button>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Detalhamento Full e Local */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Reposição Full */}
                    {sugestao.reposicaoFull && (
                      <Card className="border-blue-200 dark:border-blue-800">
                        <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30">
                          <CardTitle className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2">
                              <Truck className="h-4 w-4 text-blue-600" />
                              Reposição Full
                            </span>
                            {getStatusBadge(sugestao.reposicaoFull.status)}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-3">
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-gray-500">Ponto Reposição:</p>
                              <p className="font-bold text-blue-600">
                                {sugestao.reposicaoFull.pontoReposicao} un
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500">Sugerido:</p>
                              <p className="font-bold text-blue-600">
                                {sugestao.reposicaoFull.quantidadeSugerida} un
                              </p>
                            </div>
                          </div>
                          <div className="pt-2 border-t">
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              {sugestao.reposicaoFull.mensagem}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Reposição Local */}
                    <Card className="border-orange-200 dark:border-orange-800">
                      <CardHeader className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/30">
                        <CardTitle className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <ShoppingCart className="h-4 w-4 text-orange-600" />
                            Reposição Local
                          </span>
                          {getStatusBadge(sugestao.reposicaoLocal.status)}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4 space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-gray-500">Ponto Reposição:</p>
                            <p className="font-bold text-orange-600">
                              {sugestao.reposicaoLocal.pontoReposicao} un
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">Sugerido:</p>
                            <p className="font-bold text-orange-600">
                              {sugestao.reposicaoLocal.quantidadeSugerida} un
                            </p>
                          </div>
                        </div>
                        <div className="pt-2 border-t">
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            {sugestao.reposicaoLocal.mensagem}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Nenhuma análise disponível
                </div>
              )}
            </TabsContent>

            {/* ABA: CONFIGURAÇÃO */}
            <TabsContent value="configuracao" className="space-y-6">
              {/* Período de Análise - Destaque */}
              <Card className="border-2 border-purple-200 dark:border-purple-800">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-purple-600" />
                    Período de Análise de Vendas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setConfig({ ...config, analysisPeriodDays: 30 });
                        setTimeout(calcularSugestao, 100);
                      }}
                      className={`px-6 py-4 rounded-lg font-semibold text-lg transition-all ${
                        config.analysisPeriodDays === 30
                          ? "bg-purple-600 text-white shadow-lg scale-105"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-2 border-gray-300 dark:border-gray-600 hover:border-purple-400 dark:hover:border-purple-600"
                      }`}
                    >
                      30 dias
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfig({ ...config, analysisPeriodDays: 60 });
                        setTimeout(calcularSugestao, 100);
                      }}
                      className={`px-6 py-4 rounded-lg font-semibold text-lg transition-all ${
                        config.analysisPeriodDays === 60
                          ? "bg-purple-600 text-white shadow-lg scale-105"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-2 border-gray-300 dark:border-gray-600 hover:border-purple-400 dark:hover:border-purple-600"
                      }`}
                    >
                      60 dias
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfig({ ...config, analysisPeriodDays: 90 });
                        setTimeout(calcularSugestao, 100);
                      }}
                      className={`px-6 py-4 rounded-lg font-semibold text-lg transition-all ${
                        config.analysisPeriodDays === 90
                          ? "bg-purple-600 text-white shadow-lg scale-105"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-2 border-gray-300 dark:border-gray-600 hover:border-purple-400 dark:hover:border-purple-600"
                      }`}
                    >
                      90 dias
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
                    ℹ️ Define quantos dias de vendas serão considerados para calcular a média diária.
                    A análise será recalculada automaticamente ao mudar o período.
                  </p>
                </CardContent>
              </Card>

              {/* Outros Parâmetros */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Parâmetros de Tempo e Segurança</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="avgDeliveryDays">
                        Tempo de Entrega (dias)
                      </Label>
                      <Input
                        id="avgDeliveryDays"
                        type="number"
                        min="1"
                        value={config.avgDeliveryDays}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            avgDeliveryDays: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="fullReleaseDays">Tempo Full (dias)</Label>
                      <Input
                        id="fullReleaseDays"
                        type="number"
                        min="0"
                        value={config.fullReleaseDays}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            fullReleaseDays: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="safetyStock">Estoque Segurança (unid.)</Label>
                      <Input
                        id="safetyStock"
                        type="number"
                        min="0"
                        value={config.safetyStock}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            safetyStock: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="minCoverageDays">Cobertura Mínima (dias)</Label>
                      <Input
                        id="minCoverageDays"
                        type="number"
                        min="1"
                        value={config.minCoverageDays}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            minCoverageDays: parseInt(e.target.value) || 30,
                          })
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ABA: DETALHES */}
            <TabsContent value="detalhes" className="space-y-6">
              {produto && (
                <>
                  {/* Informações do Produto */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Informações do Produto</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Nome:</p>
                          <p className="font-semibold">{produto.nome}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">SKU:</p>
                          <p className="font-semibold">{produto.sku}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Custo Médio:</p>
                          <p className="font-semibold text-green-600">
                            {formatCurrency(produto.custoMedio)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Estoque Total:</p>
                          <p className="font-semibold">
                            {produto.estoques.reduce((sum, e) => sum + e.quantidade, 0)} un
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Estoque por Armazém */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Estoque por Armazém</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {produto.estoques.map((estoque, index) => (
                          <div
                            key={index}
                            className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                          >
                            <span className="font-medium">{estoque.armazem.nome}</span>
                            <span className="font-bold text-lg">{estoque.quantidade} un</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer Fixo */}
        <div className="sticky bottom-0 backdrop-blur-md bg-white/90 dark:bg-gray-900/90 border-t border-gray-200 dark:border-gray-800 p-6 rounded-b-xl">
          <DialogFooter className="flex items-center justify-between">
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
            <Button
              onClick={handleSalvar}
              disabled={loading}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Configuração
                </>
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
