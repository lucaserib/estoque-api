// Import the useEffect hook if it's not already imported
import { useState, useEffect } from "react";
import { formatBRL } from "@/utils/currency";

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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  Warehouse,
  Package,
  AlertTriangle,
  X,
  Save,
  Loader2,
  MinusCircle,
} from "lucide-react";
import { Armazem, Pedido } from "@/app/(root)/gestao-pedidos/types";
import { ScrollArea } from "./ui/scroll-area";

interface PedidoConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  pedido: Pedido;
  armazens: Armazem[];
  onSuccess: (pedidoId: number, novoPedidoId?: number) => void;
}

export function PedidoConfirmDialog({
  isOpen,
  onClose,
  pedido,
  armazens,
  onSuccess,
}: PedidoConfirmDialogProps) {
  const [armazemId, setArmazemId] = useState<string>("");
  const [comentarios, setComentarios] = useState<string>(
    pedido.comentarios || ""
  );
  const [produtos, setProdutos] = useState(
    pedido.produtos.map((produto) => ({
      produtoId: produto.produtoId,
      quantidade: produto.quantidade,
      custo: produto.custo,
      multiplicador:
        produto.multiplicador || produto.produto?.multiplicador || 1,
      produto: produto.produto,
    }))
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Important fix: Add cleanup for focus management
  useEffect(() => {
    return () => {
      // Force focus back to the document when component unmounts
      if (!isOpen) {
        setTimeout(() => {
          document.body.focus();
        }, 0);
      }
    };
  }, [isOpen]);

  // Verificar se algum produto tem quantidade menor que a original
  const hasMenorQuantidade = () => {
    return produtos.some(
      (produto, index) => produto.quantidade < pedido.produtos[index].quantidade
    );
  };

  // Atualizar quantidade de um produto
  const handleQuantityChange = (produtoId: string, value: number) => {
    setProdutos(
      produtos.map((produto) =>
        produto.produtoId === produtoId
          ? { ...produto, quantidade: value }
          : produto
      )
    );
  };

  // Atualizar custo de um produto
  const handleCostChange = (produtoId: string, value: number) => {
    setProdutos(
      produtos.map((produto) =>
        produto.produtoId === produtoId ? { ...produto, custo: value } : produto
      )
    );
  };

  // Calcular valor total do pedido
  const calcularValorTotal = () => {
    return produtos.reduce((total, produto) => {
      const subtotal =
        produto.quantidade * produto.custo * (produto.multiplicador || 1);
      return total + subtotal;
    }, 0);
  };

  // Confirmar pedido
  const handleSubmit = async () => {
    // Validação
    if (!armazemId) {
      setError("Selecione um armazém para receber os produtos");
      return;
    }

    if (produtos.some((p) => p.quantidade < 0)) {
      setError("A quantidade não pode ser negativa");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/pedidos-compra", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pedidoId: pedido.id,
          armazemId,
          produtosRecebidos: produtos,
          comentarios,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Ocorreu um erro ao confirmar o pedido");
      }

      onSuccess(pedido.id, data.novoPedidoId);
    } catch (error) {
      console.error("Erro ao confirmar pedido:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Ocorreu um erro ao confirmar o pedido"
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
          // Important fix: Ensure we focus on a neutral element before closing
          document.body.focus();
          setTimeout(() => {
            onClose();
          }, 0);
        }
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 gap-0 bg-white/95 dark:bg-gray-900/95 border border-gray-200 dark:border-gray-700 shadow-xl rounded-xl backdrop-blur-md">
        <div className="sticky top-0 z-10 backdrop-blur-md bg-white/90 dark:bg-gray-900/90 border-b border-gray-200 dark:border-gray-800 rounded-t-xl">
          <DialogHeader className="p-6 pb-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-gray-800 dark:text-gray-100">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                Confirmar Recebimento - Pedido #{pedido.id}
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

        <ScrollArea className="max-h-[calc(90vh-11rem)]">
          <div className="p-6 pt-2 space-y-6">
            {/* Rest of the component's content would go here - unchanged */}
            {/* Removing for brevity as we're focusing on the focus management fix */}
          </div>
        </ScrollArea>

        <DialogFooter className="sticky bottom-0 backdrop-blur-md bg-white/90 dark:bg-gray-900/90 border-t border-gray-200 dark:border-gray-800 p-4 rounded-b-xl flex justify-between w-full">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !armazemId}
            className="gap-2 bg-green-600 hover:bg-green-700 text-white"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Confirmar Recebimento
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
