import { useState } from "react";
import { Fornecedor } from "../app/(root)/fornecedores/types";
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
import { Loader2, AlertTriangle, Trash, Link } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface FornecedorDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fornecedor: Fornecedor;
  onConfirm: (id: string, forceDelete: boolean) => void;
  hasVinculos?: {
    hasOrders: boolean;
    hasProducts: boolean;
  };
}

export function FornecedorDeleteDialog({
  isOpen,
  onClose,
  fornecedor,
  onConfirm,
  hasVinculos,
}: FornecedorDeleteDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forceDelete, setForceDelete] = useState(false);

  const handleDelete = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(fornecedor.id.toString(), forceDelete);
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
            <AlertDialogTitle>Excluir Fornecedor</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-3">
            Tem certeza que deseja excluir o fornecedor{" "}
            <span className="font-medium text-foreground">
              {fornecedor.nome}
            </span>
            ?
            {hasVinculos && (
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 text-sm rounded-md border border-amber-200 dark:border-amber-800">
                <p className="flex items-center gap-2 font-medium">
                  <Link className="h-4 w-4" />
                  Este fornecedor possui vínculos ativos:
                </p>
                <ul className="mt-2 ml-6 list-disc space-y-1">
                  {hasVinculos.hasProducts && <li>Vinculado a produtos</li>}
                  {hasVinculos.hasOrders && <li>Possui pedidos de compra</li>}
                </ul>

                <div className="mt-3 flex items-start gap-2">
                  <Checkbox
                    id="forceDelete"
                    checked={forceDelete}
                    onCheckedChange={(checked: boolean | "indeterminate") =>
                      setForceDelete(checked === true)
                    }
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label
                      htmlFor="forceDelete"
                      className="text-sm font-medium cursor-pointer"
                    >
                      Excluir todos os vínculos
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Isso irá remover todos os vínculos com produtos e pedidos
                      associados a este fornecedor
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className="mt-4 p-3 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/20">
              <p>Esta ação não pode ser desfeita.</p>
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
              disabled={isSubmitting || (hasVinculos && !forceDelete)}
              className="gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash className="h-4 w-4" />
                  {hasVinculos && !forceDelete
                    ? "Selecione a opção para excluir"
                    : "Sim, excluir fornecedor"}
                </>
              )}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
