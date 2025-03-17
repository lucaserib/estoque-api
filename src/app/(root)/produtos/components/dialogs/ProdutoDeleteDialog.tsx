import { useState } from "react";
import { Produto } from "../../types";

// UI Components
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle } from "lucide-react";

interface ProdutoDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  produto: Produto;
  onConfirm: (id: string) => void;
}

export function ProdutoDeleteDialog({
  isOpen,
  onClose,
  produto,
  onConfirm,
}: ProdutoDeleteDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDelete = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(produto.id);
    } finally {
      setIsSubmitting(false);
      onClose();
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <AlertDialogTitle>Excluir Produto</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-3">
            Tem certeza que deseja excluir o produto{" "}
            <span className="font-medium text-foreground">{produto.nome}</span>?
            <div className="mt-4 p-3 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/20">
              <p>
                Esta ação não pode ser desfeita. Se o produto estiver vinculado
                a pedidos, fornecedores ou outros registros, estes vínculos
                também serão excluídos.
              </p>
              {produto.isKit && (
                <p className="mt-2">
                  <strong>Atenção:</strong> Este é um kit e sua exclusão não
                  removerá os produtos componentes do sistema.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            className="border-gray-300 dark:border-gray-600"
            disabled={isSubmitting}
          >
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            asChild
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
          >
            <Button
              variant="destructive"
              disabled={isSubmitting}
              className="gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                "Sim, excluir produto"
              )}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
