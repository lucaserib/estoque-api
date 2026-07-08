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
import { X, Box, Barcode, Package } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import EANDisplay from "@/components/EANDisplay";

interface KitDetalhesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  kit: Produto;
}

export function KitDetalhesDialog({
  isOpen,
  onClose,
  kit,
}: KitDetalhesDialogProps) {
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
      <DialogContent className="max-w-xl max-h-[90vh] p-0 gap-0 bg-card/95 border border-border shadow-xl rounded-xl backdrop-blur-md">
        <div className="sticky top-0 z-10 backdrop-blur-md bg-card/90 border-b border-border rounded-t-xl">
          <DialogHeader className="p-6 pb-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                <Box className="h-5 w-5 text-indigo-500" />
                Detalhes do Kit
              </DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 rounded-full border border-border"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
        </div>

        <ScrollArea className="max-h-[calc(90vh-11rem)]">
          <div className="p-6 pt-2 space-y-6">
            <div className="bg-background p-4 rounded-lg border border-border">
              <div className="grid grid-cols-1 gap-2">
                <div className="flex flex-col">
                  <span className="text-sm text-muted-foreground">
                    Nome:
                  </span>
                  <span className="text-base font-medium text-foreground">
                    {kit.nome}
                  </span>
                </div>

                <div className="flex flex-col mt-3">
                  <span className="text-sm text-muted-foreground">
                    SKU:
                  </span>
                  <div className="flex items-center">
                    <Barcode className="h-4 w-4 text-muted-foreground mr-1" />
                    <span className="text-base font-medium text-foreground">
                      {kit.sku}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <p className="text-sm font-medium">Código EAN</p>
                    <EANDisplay produto={kit} className="mt-1" />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Package className="h-5 w-5 text-indigo-500" />
                Componentes do Kit
              </h3>

              {kit.componentes && kit.componentes.length > 0 ? (
                <div className="border border-border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-background">
                      <TableRow>
                        <TableHead className="font-medium">Produto</TableHead>
                        <TableHead className="font-medium">SKU</TableHead>
                        <TableHead className="font-medium text-right">
                          Quantidade
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {kit.componentes.map((componente, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">
                            {componente.produto?.nome ||
                              "Produto não encontrado"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {componente.produto?.sku || "N/A"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant="outline"
                              className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                            >
                              {componente.quantidade} unidades
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="bg-background p-6 rounded-lg border border-border text-center">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">
                    Este kit não possui componentes ou os dados não estão
                    disponíveis.
                  </p>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
