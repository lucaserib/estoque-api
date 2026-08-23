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
import { StatusPill } from "@/components/ui/status-pill";
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
    analysisPeriodDays: 90,
  });
  const [sugestao, setSugestao] = useState<ReplenishmentSuggestion | null>(
    null
  );

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
          <StatusPill tone="critical" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Crítico
          </StatusPill>
        );
      case "atencao":
        return (
          <StatusPill tone="warning" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            Atenção
          </StatusPill>
        );
      default:
        return (
          <StatusPill tone="success" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            OK
          </StatusPill>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0 bg-card/95 border border-border shadow-xl rounded-xl backdrop-blur-md">
        <div className="sticky top-0 z-10 backdrop-blur-md bg-card/90 border-b border-border rounded-t-xl">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
              <TrendingUp className="h-5 w-5 text-primary" />
              Sugestão de Reposição
            </DialogTitle>
            <DialogDescription className="text-muted-foreground mt-2">
              <span className="font-semibold text-foreground">
                {produto.nome}
              </span>
              <br />
              SKU: {produto.sku}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-6 p-6">
          {/* Configuração */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-foreground">
              Parâmetros de Reposição
            </h3>

            {/* Período de Análise - Destacado */}
            <div className="bg-primary/10 p-4 rounded-lg border-2 border-primary/30">
              <Label
                htmlFor="analysisPeriodDays"
                className="text-sm font-semibold text-primary mb-2 block"
              >
                Período de Análise de Vendas
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setConfig({ ...config, analysisPeriodDays: 30 })
                  }
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    config.analysisPeriodDays === 30
                      ? "bg-primary text-primary-foreground shadow-lg scale-105"
                      : "bg-card text-foreground border border-input hover:border-primary/50"
                  }`}
                >
                  30 dias
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setConfig({ ...config, analysisPeriodDays: 60 })
                  }
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    config.analysisPeriodDays === 60
                      ? "bg-primary text-primary-foreground shadow-lg scale-105"
                      : "bg-card text-foreground border border-input hover:border-primary/50"
                  }`}
                >
                  60 dias
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setConfig({ ...config, analysisPeriodDays: 90 })
                  }
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    config.analysisPeriodDays === 90
                      ? "bg-primary text-primary-foreground shadow-lg scale-105"
                      : "bg-card text-foreground border border-input hover:border-primary/50"
                  }`}
                >
                  90 dias
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Define quantos dias de vendas serão considerados para
                calcular a média diária
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="avgDeliveryDays">Tempo de Entrega (dias)</Label>
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
                <h3 className="font-semibold text-sm text-foreground">
                  Análise Inteligente
                </h3>
                {getStatusBadge(sugestao.statusGeral)}
              </div>

              {/* Visão Geral dos Estoques */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-background p-3 rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground mb-1">
                    Estoque Local
                  </p>
                  <p className="text-2xl font-bold text-foreground">
                    {sugestao.estoqueLocal}
                  </p>
                </div>
                <div className="bg-background p-3 rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground mb-1">
                    Estoque Full
                  </p>
                  <p className="text-2xl font-bold text-info">
                    {sugestao.estoqueFull}
                  </p>
                </div>
                <div className="bg-background p-3 rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground mb-1">
                    Total
                  </p>
                  <p className="text-2xl font-bold text-foreground">
                    {sugestao.estoqueTotal}
                  </p>
                </div>
                <div className="bg-background p-3 rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground mb-1">
                    Tipo
                  </p>
                  <p className="text-lg font-bold text-foreground uppercase">
                    {sugestao.tipoAnuncio === "full"
                      ? "Full"
                      : sugestao.tipoAnuncio === "local"
                      ? "Local"
                      : "Ambos"}
                  </p>
                </div>
              </div>

              {/* Métricas de Vendas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-background p-4 rounded-lg border border-border">
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Vendas ({config.analysisPeriodDays} dias)
                  </p>
                  <p className="text-3xl font-bold text-success">
                    {sugestao.mediaVendas90d}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    unidades vendidas
                  </p>
                </div>
                <div className="bg-background p-4 rounded-lg border border-border">
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Média Diária
                  </p>
                  <p className="text-3xl font-bold text-primary">
                    {sugestao.mediaDiaria.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    unidades/dia
                  </p>
                </div>
              </div>

              {/* Reposição Full (se aplicável) */}
              {sugestao.reposicaoFull && (
                <div className="border-2 border-info/30 rounded-lg overflow-hidden">
                  <div className="bg-info p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Truck className="h-5 w-5 text-info-foreground" />
                        <h4 className="font-semibold text-info-foreground">
                          Reposição Full (Transferência Local → Full)
                        </h4>
                      </div>
                      {getStatusBadge(sugestao.reposicaoFull.status)}
                    </div>
                  </div>
                  <div className="bg-info/10 p-4 space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-xs text-info mb-1">
                          Dias Restantes
                        </p>
                        <p className="text-xl font-bold text-info">
                          {sugestao.reposicaoFull.diasRestantes > 999
                            ? "∞"
                            : sugestao.reposicaoFull.diasRestantes}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-info mb-1">
                          Ponto de Reposição
                        </p>
                        <p className="text-xl font-bold text-info">
                          {sugestao.reposicaoFull.pontoReposicao}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-info mb-1">
                          Sugerido
                        </p>
                        <p className="text-xl font-bold text-info">
                          {sugestao.reposicaoFull.quantidadeSugerida}
                        </p>
                      </div>
                    </div>

                    {sugestao.reposicaoFull.necessaria ? (
                      <div className="bg-card p-3 rounded-lg">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground mb-1">
                              {sugestao.reposicaoFull.mensagem}
                            </p>
                            {sugestao.reposicaoFull?.acaoRecomendada ===
                              "aguardar_compra" && (
                              <div className="mt-2 p-2 bg-warning/10 border border-warning/30 rounded">
                                <p className="text-xs text-warning flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  <strong>Atenção:</strong> Será necessário
                                  comprar produtos do fornecedor antes de
                                  transferir para Full
                                </p>
                              </div>
                            )}
                            {sugestao.reposicaoFull?.acaoRecomendada ===
                              "transferir" && (
                              <p className="text-xs text-info mt-1">
                                ✓ Estoque local disponível para transferência
                                imediata
                              </p>
                            )}
                          </div>
                          {sugestao.reposicaoFull?.acaoRecomendada ===
                            "transferir" && (
                            <Button
                              size="sm"
                              className="gap-2 bg-info text-info-foreground hover:bg-info/90 shrink-0"
                              onClick={() =>
                                toast.info(
                                  "Funcionalidade de transferência em desenvolvimento"
                                )
                              }
                            >
                              <Truck className="h-4 w-4" />
                              Transferir Agora
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-card p-3 rounded-lg">
                        <p className="text-sm text-success flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" />
                          {sugestao.reposicaoFull.mensagem}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Reposição Local */}
              <div className="border-2 border-warning/30 rounded-lg overflow-hidden">
                <div className="bg-warning p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5 text-warning-foreground" />
                      <h4 className="font-semibold text-warning-foreground">
                        Reposição Local (Compra do Fornecedor)
                      </h4>
                    </div>
                    {getStatusBadge(sugestao.reposicaoLocal.status)}
                  </div>
                </div>
                <div className="bg-warning/10 p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs text-warning mb-1">
                        Dias Restantes
                      </p>
                      <p className="text-xl font-bold text-warning">
                        {sugestao.reposicaoLocal.diasRestantes > 999
                          ? "∞"
                          : sugestao.reposicaoLocal.diasRestantes}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-warning mb-1">
                        Ponto de Reposição
                      </p>
                      <p className="text-xl font-bold text-warning">
                        {sugestao.reposicaoLocal.pontoReposicao}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-warning mb-1">
                        Sugerido
                      </p>
                      <p className="text-xl font-bold text-warning">
                        {sugestao.reposicaoLocal.quantidadeSugerida}
                      </p>
                    </div>
                  </div>

                  {sugestao.reposicaoLocal.necessaria ? (
                    <div className="bg-card p-3 rounded-lg">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground mb-1">
                            {sugestao.reposicaoLocal.mensagem}
                          </p>
                          {/* Detalhamento da distribuição da compra */}
                          {(sugestao.reposicaoLocal.quantidadeParaFull > 0 ||
                            sugestao.reposicaoLocal.quantidadeParaLocal >
                              0) && (
                            <div className="mt-2 space-y-1">
                              {sugestao.reposicaoLocal.quantidadeParaFull >
                                0 && (
                                <p className="text-xs text-info">
                                  → {sugestao.reposicaoLocal.quantidadeParaFull}{" "}
                                  unidades para transferir ao Full
                                </p>
                              )}
                              {sugestao.reposicaoLocal.quantidadeParaLocal >
                                0 && (
                                <p className="text-xs text-muted-foreground">
                                  →{" "}
                                  {sugestao.reposicaoLocal.quantidadeParaLocal}{" "}
                                  unidades permanecerão no Local
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        <Button
                          size="sm"
                          className="gap-2 bg-warning text-warning-foreground hover:bg-warning/90 shrink-0"
                          onClick={() =>
                            toast.info(
                              "Funcionalidade de pedido de compra em desenvolvimento"
                            )
                          }
                        >
                          <ShoppingCart className="h-4 w-4" />
                          Gerar Pedido
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-card p-3 rounded-lg">
                      <p className="text-sm text-success flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        {sugestao.reposicaoLocal.mensagem}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Ações Prioritárias Recomendadas */}
              {sugestao.acoesPrioritarias &&
                Array.isArray(sugestao.acoesPrioritarias) &&
                sugestao.acoesPrioritarias.length > 0 && (
                  <div className="mt-5 border-t-2 border-border pt-5">
                    <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Plano de Ação Recomendado
                    </h3>
                    <div className="space-y-2">
                      {sugestao.acoesPrioritarias.map((acao, index) => (
                        <div
                          key={index}
                          className={`flex items-center justify-between p-3 rounded-lg border-2 ${
                            acao.prioridade === "alta"
                              ? "bg-destructive/10 border-destructive/30"
                              : acao.prioridade === "media"
                              ? "bg-warning/10 border-warning/30"
                              : "bg-success/10 border-success/30"
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div
                              className={`flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                                acao.prioridade === "alta"
                                  ? "bg-destructive text-destructive-foreground"
                                  : acao.prioridade === "media"
                                  ? "bg-warning text-warning-foreground"
                                  : "bg-success text-success-foreground"
                              }`}
                            >
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-sm text-foreground">
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
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {acao.origem} → {acao.destino} • Prazo:{" "}
                                {acao.prazo}
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
                                  ? "bg-warning text-warning-foreground hover:bg-warning/90"
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
                                ? "bg-info text-info-foreground border-info hover:bg-info/90"
                                : "bg-warning text-warning-foreground border-warning hover:bg-warning/90"
                            }`}
                            onClick={() => {
                              if (acao.tipo === "transferir_full") {
                                toast.info(
                                  "Funcionalidade de transferência em desenvolvimento"
                                );
                              } else {
                                toast.info(
                                  "Funcionalidade de pedido de compra em desenvolvimento"
                                );
                              }
                            }}
                          >
                            {acao.tipo === "transferir_full"
                              ? "Transferir"
                              : "Gerar Pedido"}
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

          <div className="bg-muted p-4 rounded-lg border border-input">
            <p className="font-semibold text-foreground mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              Como funciona a análise?
            </p>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div>
                <p className="font-medium text-foreground">
                  Cálculos Base:
                </p>
                <ul className="list-disc list-inside space-y-0.5 ml-2">
                  <li>
                    Média Diária = Vendas do período selecionado (
                    {config.analysisPeriodDays} dias) ÷{" "}
                    {config.analysisPeriodDays}
                  </li>
                  <li>
                    Vendas calculadas proporcionalmente a partir dos últimos 90
                    dias
                  </li>
                  <li>
                    Dados de vendas atualizados via sincronização ML ("Atualizar
                    Dados")
                  </li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-foreground">
                  Reposição Full (Transferência):
                </p>
                <ul className="list-disc list-inside space-y-0.5 ml-2">
                  <li>
                    Considera tempo de liberação após coleta (~
                    {config.fullReleaseDays} dias)
                  </li>
                  <li>
                    Verifica se há estoque local suficiente para transferir
                  </li>
                  <li>Mais rápido: produtos chegam ao Full em poucos dias</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-foreground">
                  Reposição Local (Compra):
                </p>
                <ul className="list-disc list-inside space-y-0.5 ml-2">
                  <li>
                    Considera tempo de entrega do fornecedor (~
                    {config.avgDeliveryDays} dias)
                  </li>
                  <li>
                    Garante cobertura mínima de {config.minCoverageDays} dias de
                    vendas
                  </li>
                  <li>
                    Inclui estoque de segurança de {config.safetyStock} unidades
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 backdrop-blur-md bg-card/90 border-t border-border p-6 rounded-b-xl">
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
            <Button onClick={handleSalvar} disabled={loading}>
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
