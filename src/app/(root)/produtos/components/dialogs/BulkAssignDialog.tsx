"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Loader2, Truck } from "lucide-react";
import { toast } from "sonner";

interface Fornecedor {
  id: string;
  nome: string;
}

interface BulkAssignDialogProps {
  isOpen: boolean;
  onClose: () => void;
  produtoIds: string[];
  onApplied: () => void;
}

export function BulkAssignDialog({
  isOpen,
  onClose,
  produtoIds,
  onApplied,
}: BulkAssignDialogProps) {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [custoMedio, setCustoMedio] = useState("");
  const [vincularFornecedor, setVincularFornecedor] = useState(false);
  const [fornecedorId, setFornecedorId] = useState("");
  const [preco, setPreco] = useState("");
  const [multiplicador, setMultiplicador] = useState("1");
  const [codigoNF, setCodigoNF] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    const fetchFornecedores = async () => {
      try {
        const response = await fetch("/api/fornecedores");
        if (!response.ok) return;
        const data = await response.json();
        if (Array.isArray(data)) setFornecedores(data);
      } catch (fetchError) {
        console.error("Erro ao buscar fornecedores:", fetchError);
      }
    };

    fetchFornecedores();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setCustoMedio("");
      setVincularFornecedor(false);
      setFornecedorId("");
      setPreco("");
      setMultiplicador("1");
      setCodigoNF("");
      setError("");
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    setError("");

    const custoMedioEmCentavos = custoMedio
      ? Math.round(Number(custoMedio) * 100)
      : undefined;

    if (custoMedio && (!Number.isFinite(Number(custoMedio)) || Number(custoMedio) < 0)) {
      setError("Custo médio inválido");
      return;
    }

    if (!custoMedio && !vincularFornecedor) {
      setError("Informe um custo médio ou vincule um fornecedor");
      return;
    }

    if (vincularFornecedor && (!fornecedorId || !preco || !multiplicador || !codigoNF)) {
      setError(
        "Para vincular fornecedor, preencha fornecedor, preço, multiplicador e código NF"
      );
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/produtos/bulk-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          produtoIds,
          custoMedio: custoMedioEmCentavos,
          fornecedor: vincularFornecedor
            ? {
                fornecedorId,
                preco: Number(preco),
                multiplicador: Number(multiplicador),
                codigoNF,
              }
            : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao aplicar atribuição em lote");
        return;
      }

      toast.success(
        `${data.updated} produto(s) atualizado(s)${
          data.skipped.length > 0 ? ` · ${data.skipped.length} ignorado(s)` : ""
        }`
      );
      onApplied();
      onClose();
    } catch (submitError) {
      console.error("Erro ao aplicar atribuição em lote:", submitError);
      setError("Erro ao aplicar atribuição em lote");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Atribuir custo e fornecedor
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Aplicar para {produtoIds.length} produto(s) selecionado(s).
          </p>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="bulk-custo">Custo médio (R$)</Label>
            <Input
              id="bulk-custo"
              type="number"
              step="0.01"
              min="0"
              placeholder="Deixe em branco para não alterar"
              value={custoMedio}
              onChange={(e) => setCustoMedio(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Vincular fornecedor</p>
              <p className="text-xs text-muted-foreground">
                Define o fornecedor principal dos produtos selecionados
              </p>
            </div>
            <Switch
              checked={vincularFornecedor}
              onCheckedChange={setVincularFornecedor}
              disabled={submitting}
            />
          </div>

          {vincularFornecedor && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="bulk-fornecedor">Fornecedor</Label>
                <Select value={fornecedorId} onValueChange={setFornecedorId}>
                  <SelectTrigger id="bulk-fornecedor">
                    <SelectValue placeholder="Selecione um fornecedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {fornecedores.map((fornecedor) => (
                      <SelectItem key={fornecedor.id} value={fornecedor.id}>
                        {fornecedor.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bulk-preco">Preço (R$)</Label>
                <Input
                  id="bulk-preco"
                  type="number"
                  step="0.01"
                  min="0"
                  value={preco}
                  onChange={(e) => setPreco(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bulk-multiplicador">Multiplicador</Label>
                <Input
                  id="bulk-multiplicador"
                  type="number"
                  step="0.01"
                  min="1"
                  value={multiplicador}
                  onChange={(e) => setMultiplicador(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="bulk-nf">Código NF da compra</Label>
                <Input
                  id="bulk-nf"
                  placeholder="Nota fiscal que originou este custo"
                  value={codigoNF}
                  onChange={(e) => setCodigoNF(e.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Aplicando...
              </>
            ) : (
              "Aplicar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
