import { useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Saida } from "../types";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Calendar,
  Warehouse,
  Package,
  ShoppingBag,
  X,
  Box,
} from "lucide-react";

interface SaidaDetalhesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  saida: Saida;
}

export function SaidaDetalhesDialog({
  isOpen,
  onClose,
  saida,
}: SaidaDetalhesDialogProps) {
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
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 gap-0 bg-white/95 dark:bg-gray-900/95 border border-gray-200 dark:border-gray-700 shadow-xl rounded-xl backdrop-blur-md">
        <div className="sticky top-0 z-10 backdrop-blur-md bg-white/90 dark:bg-gray-900/90 border-b border-gray-200 dark:border-gray-800 rounded-t-xl">
          <DialogHeader className="p-6 pb-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-gray-800 dark:text-gray-100">
                <ShoppingBag className="h-5 w-5 text-indigo-500" />
                Detalhes da Saída
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
            {/* Informações gerais */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    Data da Saída:
                  </span>
                  <span className="text-gray-900 dark:text-gray-100">
                    {format(new Date(saida.data), "dd/MM/yyyy", {
                      locale: ptBR,
                    })}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Warehouse className="h-4 w-4 text-gray-400" />
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    Armazém:
                  </span>
                  <span className="text-gray-900 dark:text-gray-100">
                    {saida.armazem.nome}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-gray-400" />
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    Total de Itens:
                  </span>
                  <span className="text-gray-900 dark:text-gray-100">
                    {saida.detalhes.reduce(
                      (acc, detalhe) => acc + detalhe.quantidade,
                      0
                    )}{" "}
                    unidades
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Box className="h-4 w-4 text-gray-400" />
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    ID da Saída:
                  </span>
                  <span className="text-gray-900 dark:text-gray-100">
                    #{saida.id}
                  </span>
                </div>
              </div>
            </div>

            {/* Tabela de produtos */}
            <div className="mb-4">
              <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Package className="h-4 w-4 text-indigo-500" />
                Lista de Produtos
              </h3>

              <div className="overflow-hidden rounded-md border border-gray-200 dark:border-gray-700">
                <Table>
                  <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
                    <TableRow>
                      <TableHead className="font-medium text-gray-500 dark:text-gray-400">
                        Produto
                      </TableHead>
                      <TableHead className="font-medium text-gray-500 dark:text-gray-400">
                        SKU
                      </TableHead>
                      <TableHead className="font-medium text-gray-500 dark:text-gray-400 text-center">
                        Quantidade
                      </TableHead>
                      <TableHead className="font-medium text-gray-500 dark:text-gray-400 text-center">
                        Tipo
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {saida.detalhes.map((detalhe) => (
                      <TableRow
                        key={detalhe.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/50 group"
                      >
                        <TableCell>
                          <div className="font-medium text-gray-800 dark:text-gray-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {detalhe.produto.nome}
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-600 dark:text-gray-300">
                          {detalhe.produto.sku}
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                            {detalhe.quantidade} un.
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {detalhe.isKit ? (
                            <Badge
                              variant="outline"
                              className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                            >
                              <Package className="h-3 w-3 mr-1" />
                              Kit
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800"
                            >
                              Produto
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="sticky bottom-0 bg-white/90 dark:bg-gray-900/90 border-t border-gray-200 dark:border-gray-800 p-4 rounded-b-xl">
          <Button onClick={onClose} className="px-6">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
