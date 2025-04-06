"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Calculator,
  ShieldAlert,
  Loader2,
  X,
  Check,
  AlertCircle,
  Clock,
  BarChart,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface EstoqueSegurancaCalculatorProps {
  isOpen: boolean;
  onClose: () => void;
  produtoId: string;
  produtoNome: string;
  armazemId: string;
  armazemNome: string;
  currentValue: number;
  onSave: (value: number, isAutoCalculated: boolean, leadTime: number) => void;
}

export function EstoqueSegurancaCalculator({
  isOpen,
  onClose,
  produtoId,
  produtoNome,
  armazemId,
  armazemNome,
  currentValue,
  onSave,
}: EstoqueSegurancaCalculatorProps) {
  const [isAutoCalculated, setIsAutoCalculated] = useState(false);
  const [manualValue, setManualValue] = useState(currentValue.toString());
  const [leadTime, setLeadTime] = useState("7");
  const [mediaSaidas, setMediaSaidas] = useState<number | null>(null);
  const [estoqueSegurancaSugerido, setEstoqueSegurancaSugerido] = useState<
    number | null
  >(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Limpar erros quando o modo é alterado
  useEffect(() => {
    setError("");
  }, [isAutoCalculated]);

  // Calcular o estoque de segurança automaticamente
  const calcularEstoqueSeguranca = async () => {
    if (!produtoId || !armazemId) {
      setError("Informações do produto ou armazém ausentes");
      return;
    }

    setIsCalculating(true);
    setError("");

    try {
      // Buscar média diária de saídas dos últimos 90 dias
      const response = await fetch(
        `/api/estoque/calcular-media-saidas?produtoId=${produtoId}&dias=90`
      );

      if (!response.ok) {
        throw new Error("Erro ao obter média de saídas");
      }

      const data = await response.json();
      const mediaDiaria = data.mediaDiaria || 0;
      setMediaSaidas(mediaDiaria);

      // Calcular o estoque de segurança = média diária * dias de lead time
      const leadTimeDias = parseInt(leadTime, 10);
      if (isNaN(leadTimeDias) || leadTimeDias <= 0) {
        throw new Error("Tempo de reposição inválido");
      }

      // Fórmula: Estoque de Segurança = Média Diária * Tempo de Reposição * Fator de Segurança (1.5)
      const fatorSeguranca = 1.5; // Adiciona 50% como margem de segurança
      const estoqueCalculado = Math.ceil(
        mediaDiaria * leadTimeDias * fatorSeguranca
      );

      setEstoqueSegurancaSugerido(estoqueCalculado);
    } catch (error) {
      console.error("Erro ao calcular estoque de segurança:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Erro ao calcular estoque de segurança"
      );
    } finally {
      setIsCalculating(false);
    }
  };

  // Efeito para calcular automaticamente quando o modo auto é selecionado
  useEffect(() => {
    if (isAutoCalculated && !estoqueSegurancaSugerido && !isCalculating) {
      calcularEstoqueSeguranca();
    }
  }, [
    isAutoCalculated,
    calcularEstoqueSeguranca,
    estoqueSegurancaSugerido,
    isCalculating,
  ]);

  // Efeito para recalcular quando o lead time é alterado
  useEffect(() => {
    if (isAutoCalculated && mediaSaidas !== null) {
      const leadTimeDias = parseInt(leadTime, 10);
      if (!isNaN(leadTimeDias) && leadTimeDias > 0) {
        const fatorSeguranca = 1.5;
        const estoqueCalculado = Math.ceil(
          mediaSaidas * leadTimeDias * fatorSeguranca
        );
        setEstoqueSegurancaSugerido(estoqueCalculado);
      }
    }
  }, [leadTime, mediaSaidas, isAutoCalculated]);

  const handleSave = async () => {
    setIsSubmitting(true);
    setError("");

    try {
      let valorFinal: number;

      if (isAutoCalculated) {
        if (estoqueSegurancaSugerido === null) {
          throw new Error("Estoque de segurança não calculado");
        }
        valorFinal = estoqueSegurancaSugerido;
      } else {
        const valor = parseInt(manualValue, 10);
        if (isNaN(valor) || valor < 0) {
          throw new Error("Valor manual inválido");
        }
        valorFinal = valor;
      }

      const leadTimeDias = parseInt(leadTime, 10);

      // Chama o callback de salvamento
      onSave(valorFinal, isAutoCalculated, leadTimeDias);

      // Mostra toast de sucesso
      toast.success(`Definido como ${valorFinal} unidades para ${produtoNome}`);

      // Fecha o modal
      onClose();
    } catch (error) {
      console.error("Erro ao salvar estoque de segurança:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Erro ao salvar estoque de segurança"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-indigo-500" />
            Configurar Estoque de Segurança
          </DialogTitle>
          <DialogDescription>
            Configure o estoque mínimo para evitar rupturas de estoque
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[500px] pr-4">
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium mb-2">Informações</h3>
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <p>
                  <span className="font-medium">Produto:</span> {produtoNome}
                </p>
                <p>
                  <span className="font-medium">Armazém:</span> {armazemNome}
                </p>
                <p>
                  <span className="font-medium">Valor atual:</span>{" "}
                  {currentValue} unidades
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between space-x-2">
              <div className="flex items-center space-x-2">
                <Switch
                  id="auto-calculation"
                  checked={isAutoCalculated}
                  onCheckedChange={setIsAutoCalculated}
                />
                <Label htmlFor="auto-calculation" className="cursor-pointer">
                  Cálculo automático
                </Label>
              </div>

              {isAutoCalculated && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={calcularEstoqueSeguranca}
                  disabled={isCalculating}
                >
                  {isCalculating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Calculando...
                    </>
                  ) : (
                    <>
                      <Calculator className="h-4 w-4 mr-2" />
                      Recalcular
                    </>
                  )}
                </Button>
              )}
            </div>

            {isAutoCalculated ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="leadTime" className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    Tempo de reposição (em dias)
                  </Label>
                  <Input
                    id="leadTime"
                    type="number"
                    min="1"
                    value={leadTime}
                    onChange={(e) => setLeadTime(e.target.value)}
                    placeholder="Ex: 7"
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-gray-500">
                    Tempo médio entre o pedido e recebimento do produto
                  </p>
                </div>

                {isCalculating ? (
                  <div className="flex flex-col items-center justify-center py-6">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-2" />
                    <p className="text-sm text-gray-500">
                      Calculando estoque de segurança...
                    </p>
                  </div>
                ) : mediaSaidas !== null ? (
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                    <h4 className="font-medium text-blue-700 dark:text-blue-300 flex items-center gap-2 mb-2">
                      <BarChart className="h-4 w-4" />
                      Resultados do cálculo
                    </h4>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-300">
                          Média de saídas diárias:
                        </span>
                        <span className="font-medium text-gray-800 dark:text-gray-200">
                          {mediaSaidas.toFixed(2)} unidades/dia
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-300">
                          Tempo de reposição:
                        </span>
                        <span className="font-medium text-gray-800 dark:text-gray-200">
                          {leadTime} dias
                        </span>
                      </div>

                      <div className="flex justify-between border-t border-blue-200 dark:border-blue-700 pt-2 mt-2">
                        <span className="text-gray-700 dark:text-gray-200 font-medium">
                          Estoque de segurança sugerido:
                        </span>
                        <span className="font-bold text-blue-700 dark:text-blue-300">
                          {estoqueSegurancaSugerido} unidades
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                      Cálculo: Média diária × Tempo de reposição × Fator de
                      segurança (1.5)
                    </p>
                  </div>
                ) : (
                  <Alert variant="warning">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Clique em &quot;Recalcular&quot; para obter a sugestão de
                      estoque de segurança.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="manualValue">Valor manual</Label>
                <Input
                  id="manualValue"
                  type="number"
                  min="0"
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value)}
                  placeholder="Ex: 10"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-gray-500">
                  Defina manualmente quantas unidades deseja manter como estoque
                  mínimo
                </p>
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              isSubmitting ||
              (isAutoCalculated && estoqueSegurancaSugerido === null)
            }
            className="gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Salvar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
