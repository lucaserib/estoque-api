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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { X, Warehouse, Package, Loader2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface StockItem {
  produtoId: string;
  armazemId: string;
  quantidade: number;
  estoqueSeguranca?: number;
  armazem?: { id: string; nome: string };
}

interface ProdutoEstoqueDialogProps {
  isOpen: boolean;
  onClose: () => void;
  produto: Produto;
  stockDetails: StockItem[];
  isLoading: boolean;
}

export function ProdutoEstoqueDialog({
  isOpen,
  onClose,
  produto,
  stockDetails,
  isLoading,
}: ProdutoEstoqueDialogProps) {
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

  // Calculate stock safety percentage
  const calcularPorcentual = (atual: number, seguranca: number) => {
    if (seguranca === 0) return 100;
    return Math.min((atual / seguranca) * 100, 100);
  };

  // Get progress color based on percentage
  const getProgressColor = (percentual: number) => {
    if (percentual <= 30) return "bg-red-500";
    if (percentual <= 60) return "bg-orange-500";
    return "bg-green-500";
  };

  // Calculate total stock
  const totalStock = stockDetails.reduce(
    (total, item) => total + item.quantidade,
    0
  );

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
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 gap-0 bg-white/95 dark:bg-gray-900/95 border border-gray-200 dark:border-gray-700 shadow-xl rounded-xl backdrop-blur-md">
        <div className="sticky top-0 z-10 backdrop-blur-md bg-white/90 dark:bg-gray-900/90 border-b border-gray-200 dark:border-gray-800 rounded-t-xl">
          <DialogHeader className="p-6 pb-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-gray-800 dark:text-gray-100">
                <Warehouse className="h-5 w-5 text-indigo-500" />
                Estoque de {produto.nome}
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
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-gray-500" />
                  <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">
                    {produto.sku}
                  </h3>
                </div>
                <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                  Estoque Total: {totalStock}
                </Badge>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Warehouse className="h-5 w-5 text-indigo-500" />
                Estoque por Armazém
              </h3>

              {isLoading ? (
                <div className="flex justify-center items-center py-10">
                  <div className="flex flex-col items-center">
                    <Loader2 className="h-10 w-10 text-indigo-500 animate-spin mb-2" />
                    <p className="text-gray-500 dark:text-gray-400">
                      Carregando informações de estoque...
                    </p>
                  </div>
                </div>
              ) : stockDetails.length === 0 ? (
                <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-lg border border-gray-200 dark:border-gray-700 text-center">
                  <Warehouse className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">
                    Nenhum estoque cadastrado para este produto.
                  </p>
                </div>
              ) : (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
                      <TableRow>
                        <TableHead className="font-medium">Armazém</TableHead>
                        <TableHead className="font-medium text-center">
                          Quantidade
                        </TableHead>
                        <TableHead className="font-medium text-center">
                          Est. Segurança
                        </TableHead>
                        <TableHead className="font-medium">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockDetails.map((item) => {
                        const percentual = calcularPorcentual(
                          item.quantidade,
                          item.estoqueSeguranca || 0
                        );
                        const progressClass = getProgressColor(percentual);
                        const isCritical =
                          item.quantidade < (item.estoqueSeguranca || 0);

                        return (
                          <TableRow
                            key={item.armazemId}
                            className={
                              isCritical ? "bg-red-50 dark:bg-red-900/10" : ""
                            }
                          >
                            <TableCell className="font-medium">
                              {item.armazem?.nome || "Armazém desconhecido"}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant={isCritical ? "destructive" : "outline"}
                                className={
                                  isCritical
                                    ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                                    : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                }
                              >
                                {item.quantidade} un.
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {item.estoqueSeguranca ? (
                                <Badge
                                  variant="outline"
                                  className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                                >
                                  {item.estoqueSeguranca} un.
                                </Badge>
                              ) : (
                                <span className="text-gray-400 text-sm italic">
                                  Não definido
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="w-full">
                                <Progress
                                  value={percentual}
                                  max={100}
                                  className="h-2 bg-gray-200 dark:bg-gray-700"
                                  barClassName={progressClass}
                                />
                                {isCritical && (
                                  <div className="mt-1 flex items-center">
                                    <AlertCircle className="h-3 w-3 text-red-500 mr-1" />
                                    <span className="text-xs text-red-500">
                                      {(item.estoqueSeguranca || 0) -
                                        item.quantidade}{" "}
                                      un. abaixo do mínimo
                                    </span>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
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
