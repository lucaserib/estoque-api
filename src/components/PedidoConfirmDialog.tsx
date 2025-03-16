"use client";

// UI Components
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check } from "lucide-react";

import ConfirmarPedidoForm from "@/components/ConfirmarPedidoForm";
import { Armazem, Pedido } from "@/app/(root)/gestao-pedidos/types";

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
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-gray-800 dark:text-gray-100">
            <span className="h-6 w-6 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
              <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
            </span>
            Confirmar Recebimento do Pedido #{pedido.id}
          </DialogTitle>
        </DialogHeader>

        <ConfirmarPedidoForm
          pedido={pedido}
          armazens={armazens}
          onSuccess={onSuccess}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}
