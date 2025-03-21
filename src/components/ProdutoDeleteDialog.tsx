import { useState } from "react";
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

interface ProdutoDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  produtoNome: string;
  onConfirm: (forceDelete: boolean) => Promise<void>;
  hasVinculos?: {
    hasKits: boolean;
    hasEstoque: boolean;
    hasPedidos: boolean;
    hasSaidas: boolean;
  };
}

export function ProdutoDeleteDialog({
  isOpen,
  onClose,
  produtoNome,
  onConfirm,
  hasVinculos,
}: ProdutoDeleteDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forceDelete, setForceDelete] = useState(false);

  const handleDelete = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(forceDelete);
    } finally {
      setIsSubmitting(false);
      onClose();
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-lg">
        <AlertDialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <AlertDialogTitle>Excluir Produto</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-3">
            Tem certeza que deseja excluir o produto{" "}
            <span className="font-medium text-foreground">{produtoNome}</span>?
            {hasVinculos && (
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 text-sm rounded-md border border-amber-200 dark:border-amber-800">
                <p className="flex items-center gap-2 font-medium">
                  <Link className="h-4 w-4" />
                  Este produto possui vínculos ativos:
                </p>
                <ul className="mt-2 ml-6 list-disc space-y-1">
                  {hasVinculos.hasKits && <li>É componente de kits</li>}
                  {hasVinculos.hasEstoque && <li>Possui estoque registrado</li>}
                  {hasVinculos.hasPedidos && <li>Possui pedidos de compra</li>}
                  {hasVinculos.hasSaidas && <li>Possui saídas registradas</li>}
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
                      Isso irá remover todos os vínculos com kits, estoque,
                      pedidos e saídas associados a este produto
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
            className="border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
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
              className="gap-2 bg-red-600 hover:bg-red-700 text-white"
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
                    : "Sim, excluir produto"}
                </>
              )}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
