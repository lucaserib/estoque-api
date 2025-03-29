import { useEffect, useState } from "react";
import { Produto } from "../../types";

// UI Components
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { X, Save, AlertCircle, Edit, Loader2 } from "lucide-react";

interface ProdutoEditarDialogProps {
  isOpen: boolean;
  onClose: () => void;
  produto: Produto;
  onSave: (produto: Produto) => void;
}

export function ProdutoEditarDialog({
  isOpen,
  onClose,
  produto,
  onSave,
}: ProdutoEditarDialogProps) {
  const [nome, setNome] = useState(produto.nome);
  const [sku, setSku] = useState(produto.sku);
  const [ean, setEan] = useState(produto.codigoEAN || "");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when product changes
  useEffect(() => {
    if (isOpen) {
      setNome(produto.nome);
      setSku(produto.sku);
      setEan(produto.codigoEAN || "");
      setError("");
    }
  }, [produto, isOpen]);

  // Effect for cleanup on unmounting to prevent focus issues
  useEffect(() => {
    return () => {
      if (!isOpen) {
        setTimeout(() => {
          document.body.focus();
        }, 0);
      }
    };
  }, [isOpen]);

  const handleSubmit = async () => {
    // Validate form
    if (!nome.trim()) {
      setError("O nome do produto é obrigatório");
      return;
    }
    if (!sku.trim()) {
      setError("O SKU do produto é obrigatório");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/produtos", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: produto.id,
          nome,
          sku,
          codigoEAN: ean || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao atualizar produto");
      }

      const updatedProduto = await response.json();
      onSave({
        ...updatedProduto,
        codigoEAN: updatedProduto.codigoEAN?.toString() || "",
      });
      onClose();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Erro ao salvar produto"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          // Ensure focus on a neutral element before closing
          document.body.focus();
          setTimeout(() => {
            onClose();
          }, 0);
        }
      }}
    >
      <DialogContent className="max-w-md max-h-[90vh] p-0 gap-0 bg-white/95 dark:bg-gray-900/95 border border-gray-200 dark:border-gray-700 shadow-xl rounded-xl backdrop-blur-md">
        <div className="sticky top-0 z-10 backdrop-blur-md bg-white/90 dark:bg-gray-900/90 border-b border-gray-200 dark:border-gray-800 rounded-t-xl">
          <DialogHeader className="p-6 pb-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-gray-800 dark:text-gray-100">
                <Edit className="h-5 w-5 text-indigo-500" />
                Editar Produto
              </DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                disabled={isSubmitting}
                className="h-8 w-8 rounded-full border border-gray-200 dark:border-gray-700"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
        </div>

        <div className="p-6 pt-2 space-y-4">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                placeholder="Nome do produto"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                placeholder="SKU único"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ean">EAN (Código de barras)</Label>
              <Input
                id="ean"
                placeholder="EAN (opcional)"
                value={ean}
                onChange={(e) => setEan(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="sticky bottom-0 bg-white/90 dark:bg-gray-900/90 border-t border-gray-200 dark:border-gray-800 p-4 rounded-b-xl flex justify-between w-full">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="gap-2 border-gray-200 dark:border-gray-700"
          >
            <X className="h-4 w-4" />
            Cancelar
          </Button>

          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Salvar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
