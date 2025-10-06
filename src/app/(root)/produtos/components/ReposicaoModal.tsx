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
} from "lucide-react";
import { Produto } from "../types";

interface ReposicaoModalProps {
  produto: Produto;
  isOpen: boolean;
  onClose: () => void;
}

interface ReplenishmentConfig {
  avgDeliveryDays: number;
  fullReleaseDays: number;
  safetyStock: number;
  minCoverageDays: number;
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

export function ReposicaoModal({
  produto,
  isOpen,
  onClose,
}: ReposicaoModalProps) {
  const [loading, setLoading] = useState(false);
  const [calculando, setCalculando] = useState(false);
  const [config, setConfig] = useState<ReplenishmentConfig>({
    avgDeliveryDays: 7,
    fullReleaseDays: 3,
    safetyStock: 10,
    minCoverageDays: 30,
  });
  const [sugestao, setSugestao] = useState<ReplenishmentSuggestion | null>(null);

  // Fetch config and suggestion only when modal opens
  // Use separate effect to avoid double calls
  useEffect(() => {
    if (isOpen && produto?.id) {
      buscarConfiguracao();
      calcularSugestao();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]); // Only depend on isOpen, not produto.id (produto doesn't change while modal is open)

  const buscarConfiguracao = async () => {
    try {
      const response = await fetch(
        `/api/replenishment/config?produtoId=${produto.id}`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.config && !data.isGlobal) {
          setConfig({
            avgDeliveryDays: data.config.avgDeliveryDays,
            fullReleaseDays: data.config.fullReleaseDays,
            safetyStock: data.config.safetyStock,
            minCoverageDays: data.config.minCoverageDays || 30,
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
        `/api/replenishment/suggestions/${produto.id}`
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
          produtoId: produto.id,
          ...config,
        }),
      });

      if (response.ok) {
        toast.success("Configuração de reposição salva!");
        await calcularSugestao(); // Recalcular com novos parâmetros
      } else {
        throw new Error("Erro ao salvar configuração");
      }
    } catch (error) {
      toast.error("Não foi possível salvar a configuração.");
    } finally {
      setLoading(false);
    }
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0 bg-white/95 dark:bg-gray-900/95 border border-gray-200 dark:border-gray-700 shadow-xl rounded-xl backdrop-blur-md">
        <div className="sticky top-0 z-10 backdrop-blur-md bg-white/90 dark:bg-gray-900/90 border-b border-gray-200 dark:border-gray-800 rounded-t-xl">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-gray-800 dark:text-gray-100">
              <TrendingUp className="h-5 w-5 text-indigo-500" />
              Sugestão de Reposição
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400 mt-2">
              <span className="font-semibold text-gray-800 dark:text-gray-200">{produto.nome}</span>
              <br />
              SKU: {produto.sku}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-6 p-6">
          {/* Configuração */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-200">Parâmetros de Reposição</h3>
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
          </div>

          {/* Análise */}
          {calculando ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">
                Calculando sugestão...
              </span>
            </div>
          ) : sugestao ? (
            <div className="space-y-5">
              {/* Header com Status Geral */}
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-200">Análise Inteligente</h3>
                {getStatusBadge(sugestao.statusGeral)}
              </div>

              {/* Visão Geral dos Estoques */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Estoque Local</p>
                  <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{sugestao.estoqueLocal}</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Estoque Full</p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{sugestao.estoqueFull}</p>
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg border border-indigo-200 dark:border-indigo-800">
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 mb-1">Total</p>
                  <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{sugestao.estoqueTotal}</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg border border-purple-200 dark:border-purple-800">
                  <p className="text-xs text-purple-600 dark:text-purple-400 mb-1">Tipo</p>
                  <p className="text-lg font-bold text-purple-700 dark:text-purple-300 uppercase">
                    {sugestao.tipoAnuncio === "full" ? "Full" : sugestao.tipoAnuncio === "local" ? "Local" : "Ambos"}
                  </p>
                </div>
              </div>

              {/* Métricas de Vendas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">Vendas (90 dias)</p>
                  <p className="text-3xl font-bold text-green-700 dark:text-green-300">{sugestao.mediaVendas90d}</p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">unidades vendidas</p>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
                  <p className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">Média Diária</p>
                  <p className="text-3xl font-bold text-orange-700 dark:text-orange-300">{sugestao.mediaDiaria.toFixed(2)}</p>
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">unidades/dia</p>
                </div>
              </div>

              {/* Reposição Full (se aplicável) */}
              {sugestao.reposicaoFull && (
                <div className="border-2 border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Truck className="h-5 w-5 text-white" />
                        <h4 className="font-semibold text-white">Reposição Full (Transferência Local → Full)</h4>
                      </div>
                      {getStatusBadge(sugestao.reposicaoFull.status)}
                    </div>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-950/30 p-4 space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-xs text-blue-700 dark:text-blue-300 mb-1">Dias Restantes</p>
                        <p className="text-xl font-bold text-blue-900 dark:text-blue-100">
                          {sugestao.reposicaoFull.diasRestantes > 999 ? "∞" : sugestao.reposicaoFull.diasRestantes}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-700 dark:text-blue-300 mb-1">Ponto de Reposição</p>
                        <p className="text-xl font-bold text-blue-900 dark:text-blue-100">{sugestao.reposicaoFull.pontoReposicao}</p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-700 dark:text-blue-300 mb-1">Sugerido</p>
                        <p className="text-xl font-bold text-blue-900 dark:text-blue-100">{sugestao.reposicaoFull.quantidadeSugerida}</p>
                      </div>
                    </div>

                    {sugestao.reposicaoFull.necessaria ? (
                      <div className="bg-white dark:bg-gray-900 p-3 rounded-lg">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                              {sugestao.reposicaoFull.mensagem}
                            </p>
                            {sugestao.reposicaoFull?.acaoRecomendada === "aguardar_compra" && (
                              <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded">
                                <p className="text-xs text-yellow-800 dark:text-yellow-200 flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  <strong>Atenção:</strong> Será necessário comprar produtos do fornecedor antes de transferir para Full
                                </p>
                              </div>
                            )}
                            {sugestao.reposicaoFull?.acaoRecomendada === "transferir" && (
                              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                ✓ Estoque local disponível para transferência imediata
                              </p>
                            )}
                          </div>
                          {sugestao.reposicaoFull?.acaoRecomendada === "transferir" && (
                            <Button
                              size="sm"
                              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shrink-0"
                              onClick={() => toast.info("Funcionalidade de transferência em desenvolvimento")}
                            >
                              <Truck className="h-4 w-4" />
                              Transferir Agora
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white dark:bg-gray-900 p-3 rounded-lg">
                        <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" />
                          {sugestao.reposicaoFull.mensagem}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Reposição Local */}
              <div className="border-2 border-orange-200 dark:border-orange-800 rounded-lg overflow-hidden">
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5 text-white" />
                      <h4 className="font-semibold text-white">Reposição Local (Compra do Fornecedor)</h4>
                    </div>
                    {getStatusBadge(sugestao.reposicaoLocal.status)}
                  </div>
                </div>
                <div className="bg-orange-50 dark:bg-orange-950/30 p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs text-orange-700 dark:text-orange-300 mb-1">Dias Restantes</p>
                      <p className="text-xl font-bold text-orange-900 dark:text-orange-100">
                        {sugestao.reposicaoLocal.diasRestantes > 999 ? "∞" : sugestao.reposicaoLocal.diasRestantes}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-orange-700 dark:text-orange-300 mb-1">Ponto de Reposição</p>
                      <p className="text-xl font-bold text-orange-900 dark:text-orange-100">{sugestao.reposicaoLocal.pontoReposicao}</p>
                    </div>
                    <div>
                      <p className="text-xs text-orange-700 dark:text-orange-300 mb-1">Sugerido</p>
                      <p className="text-xl font-bold text-orange-900 dark:text-orange-100">{sugestao.reposicaoLocal.quantidadeSugerida}</p>
                    </div>
                  </div>

                  {sugestao.reposicaoLocal.necessaria ? (
                    <div className="bg-white dark:bg-gray-900 p-3 rounded-lg">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                            {sugestao.reposicaoLocal.mensagem}
                          </p>
                          {/* Detalhamento da distribuição da compra */}
                          {(sugestao.reposicaoLocal.quantidadeParaFull > 0 || sugestao.reposicaoLocal.quantidadeParaLocal > 0) && (
                            <div className="mt-2 space-y-1">
                              {sugestao.reposicaoLocal.quantidadeParaFull > 0 && (
                                <p className="text-xs text-blue-600 dark:text-blue-400">
                                  → {sugestao.reposicaoLocal.quantidadeParaFull} unidades para transferir ao Full
                                </p>
                              )}
                              {sugestao.reposicaoLocal.quantidadeParaLocal > 0 && (
                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                  → {sugestao.reposicaoLocal.quantidadeParaLocal} unidades permanecerão no Local
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        <Button
                          size="sm"
                          className="gap-2 bg-orange-600 hover:bg-orange-700 text-white shrink-0"
                          onClick={() => toast.info("Funcionalidade de pedido de compra em desenvolvimento")}
                        >
                          <ShoppingCart className="h-4 w-4" />
                          Gerar Pedido
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-gray-900 p-3 rounded-lg">
                      <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        {sugestao.reposicaoLocal.mensagem}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Ações Prioritárias Recomendadas */}
              {sugestao.acoesPrioritarias && Array.isArray(sugestao.acoesPrioritarias) && sugestao.acoesPrioritarias.length > 0 && (
                <div className="mt-5 border-t-2 border-gray-200 dark:border-gray-700 pt-5">
                  <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-indigo-500" />
                    Plano de Ação Recomendado
                  </h3>
                  <div className="space-y-2">
                    {sugestao.acoesPrioritarias.map((acao, index) => (
                      <div
                        key={index}
                        className={`flex items-center justify-between p-3 rounded-lg border-2 ${
                          acao.prioridade === "alta"
                            ? "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800"
                            : acao.prioridade === "media"
                            ? "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-300 dark:border-yellow-800"
                            : "bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-800"
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div
                            className={`flex items-center justify-center w-8 h-8 rounded-full font-bold ${
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
                            <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                              {acao.tipo === "transferir_full" ? (
                                <>
                                  <Truck className="inline h-4 w-4 mr-1" />
                                  Transferir {acao.quantidade} unidades
                                </>
                              ) : (
                                <>
                                  <ShoppingCart className="inline h-4 w-4 mr-1" />
                                  Comprar {acao.quantidade} unidades
                                </>
                              )}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                              {acao.origem} → {acao.destino} • Prazo: {acao.prazo}
                            </p>
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
                          variant="outline"
                          className={`ml-3 ${
                            acao.tipo === "transferir_full"
                              ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                              : "bg-orange-600 hover:bg-orange-700 text-white border-orange-600"
                          }`}
                          onClick={() => {
                            if (acao.tipo === "transferir_full") {
                              toast.info("Funcionalidade de transferência em desenvolvimento");
                            } else {
                              toast.info("Funcionalidade de pedido de compra em desenvolvimento");
                            }
                          }}
                        >
                          {acao.tipo === "transferir_full" ? "Transferir" : "Gerar Pedido"}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              Nenhuma análise disponível
            </div>
          )}

          <div className="bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-850 p-4 rounded-lg border border-gray-300 dark:border-gray-700">
            <p className="font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              Como funciona a análise?
            </p>
            <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
              <div>
                <p className="font-medium text-gray-700 dark:text-gray-300">Cálculos Base:</p>
                <ul className="list-disc list-inside space-y-0.5 ml-2">
                  <li>Média Diária = Vendas dos últimos 90 dias ÷ 90</li>
                  <li>Dados de vendas atualizados automaticamente via sincronização ML</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-gray-700 dark:text-gray-300">Reposição Full (Transferência):</p>
                <ul className="list-disc list-inside space-y-0.5 ml-2">
                  <li>Considera tempo de liberação após coleta (~{config.fullReleaseDays} dias)</li>
                  <li>Verifica se há estoque local suficiente para transferir</li>
                  <li>Mais rápido: produtos chegam ao Full em poucos dias</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-gray-700 dark:text-gray-300">Reposição Local (Compra):</p>
                <ul className="list-disc list-inside space-y-0.5 ml-2">
                  <li>Considera tempo de entrega do fornecedor (~{config.avgDeliveryDays} dias)</li>
                  <li>Garante cobertura mínima de {config.minCoverageDays} dias de vendas</li>
                  <li>Inclui estoque de segurança de {config.safetyStock} unidades</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 backdrop-blur-md bg-white/90 dark:bg-gray-900/90 border-t border-gray-200 dark:border-gray-800 p-6 rounded-b-xl">
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
            <Button onClick={handleSalvar} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
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
