import { useEffect } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Barcode, PackageCheck, Info, Tag, DollarSign, X } from "lucide-react";
import EANDisplay from "@/components/EANDisplay";

interface ProdutoDetalhesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  produto: Produto;
}

export function ProdutoDetalhesDialog({
  isOpen,
  onClose,
  produto,
}: ProdutoDetalhesDialogProps) {
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
      <DialogContent className="max-w-lg max-h-[90vh] p-0 gap-0 bg-white/95 dark:bg-gray-900/95 border border-gray-200 dark:border-gray-700 shadow-xl rounded-xl backdrop-blur-md">
        <div className="sticky top-0 z-10 backdrop-blur-md bg-white/90 dark:bg-gray-900/90 border-b border-gray-200 dark:border-gray-800 rounded-t-xl">
          <DialogHeader className="p-6 pb-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-gray-800 dark:text-gray-100">
                <Info className="h-5 w-5 text-indigo-500" />
                Detalhes do Produto
              </DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 rounded-full border border-gray-200 dark:border-gray-700"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
        </div>

        <ScrollArea className="max-h-[calc(90vh-11rem)]">
          <div className="p-6 pt-2 space-y-6">
            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
              <div className="grid grid-cols-1 gap-4">
                <div className="flex flex-col">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Nome:
                  </span>
                  <span className="text-xl font-medium text-gray-900 dark:text-gray-100">
                    {produto.nome}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium">Código EAN</p>
                    <EANDisplay produto={produto} className="mt-1" />
                  </div>
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        SKU:
                      </span>
                      <div className="flex items-center">
                        <Barcode className="h-4 w-4 text-gray-400 mr-1" />
                        <span className="text-base font-medium text-gray-900 dark:text-gray-100">
                          {produto.sku}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                <h3 className="font-medium text-blue-700 dark:text-blue-300 flex items-center gap-2 mb-2">
                  <PackageCheck className="h-5 w-5" />
                  Informações de Estoque
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">
                      Estoque Total:
                    </span>
                    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                      {produto.estoques
                        ? produto.estoques.reduce(
                            (sum, item) => sum + item.quantidade,
                            0
                          )
                        : 0}{" "}
                      unidades
                    </Badge>
                  </div>
                  {produto.estoques && produto.estoques.length > 0 ? (
                    <div className="mt-1 space-y-1 max-h-32 overflow-y-auto">
                      {produto.estoques.map((estoque, index) => (
                        <div
                          key={index}
                          className="flex justify-between items-center text-sm bg-white/50 dark:bg-gray-800/50 p-1.5 rounded"
                        >
                          <span>{estoque.armazem?.nome || "Armazém"}</span>
                          <Badge
                            variant="outline"
                            className="bg-white dark:bg-gray-700"
                          >
                            {estoque.quantidade} un.
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                      Produto sem estoque cadastrado
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg border border-emerald-100 dark:border-emerald-800">
                <h3 className="font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-2 mb-2">
                  <DollarSign className="h-5 w-5" />
                  Informações Financeiras
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">
                      Custo Médio:
                    </span>
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                      R${" "}
                      {produto.custoMedio
                        ? (produto.custoMedio / 100).toFixed(2)
                        : "0.00"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">
                      Valor em Estoque:
                    </span>
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                      R${" "}
                      {produto.custoMedio && produto.estoques
                        ? (
                            (produto.custoMedio / 100) *
                            produto.estoques.reduce(
                              (sum, item) => sum + item.quantidade,
                              0
                            )
                          ).toFixed(2)
                        : "0.00"}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {produto.isKit && (
              <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-100 dark:border-indigo-800">
                <h3 className="font-medium text-indigo-700 dark:text-indigo-300 flex items-center gap-2 mb-2">
                  <Tag className="h-5 w-5" />
                  Informações do Kit
                </h3>
                {produto.componentes && produto.componentes.length > 0 ? (
                  <div className="space-y-2 mt-2">
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Componentes:
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {produto.componentes.map((componente, index) => (
                        <div
                          key={index}
                          className="flex justify-between bg-white/50 dark:bg-gray-800/50 p-2 rounded text-sm"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {componente.produto?.nome}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              SKU: {componente.produto?.sku}
                            </span>
                          </div>
                          <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 self-center">
                            {componente.quantidade} un.
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                    Este kit não possui componentes cadastrados
                  </p>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
