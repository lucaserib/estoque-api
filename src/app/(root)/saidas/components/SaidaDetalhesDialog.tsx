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
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";
import {
  Calendar,
  Warehouse,
  Package,
  ShoppingBag,
  X,
  Box,
  FileDown,
} from "lucide-react";

interface SaidaDetalhesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  saida: Saida;
  onExport?: () => void; // Nova propriedade para exportação
}

export function SaidaDetalhesDialog({
  isOpen,
  onClose,
  saida,
  onExport,
}: SaidaDetalhesDialogProps) {
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
          document.body.focus();
          setTimeout(() => {
            onClose();
          }, 0);
        }
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 gap-0 bg-card/95 border border-border shadow-xl rounded-xl backdrop-blur-md">
        <div className="sticky top-0 z-10 backdrop-blur-md bg-card/90 border-b border-border rounded-t-xl">
          <DialogHeader className="p-6 pb-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                <ShoppingBag className="h-5 w-5 text-primary" />
                Detalhes da Saída
              </DialogTitle>
              <div className="flex items-center gap-2">
                {onExport && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onExport}
                    className="h-8 flex items-center gap-1.5 text-success hover:bg-success/10"
                  >
                    <FileDown className="h-4 w-4" />
                    Exportar Excel
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-8 w-8 rounded-full border border-border"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>
        </div>

        <ScrollArea className="max-h-[calc(90vh-11rem)]">
          <div className="p-6 pt-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-background p-4 rounded-lg border border-border">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">
                    Data da Saída:
                  </span>
                  <span className="text-foreground">
                    {format(new Date(saida.data), "dd/MM/yyyy", {
                      locale: ptBR,
                    })}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Warehouse className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">
                    Armazém:
                  </span>
                  <span className="text-foreground">
                    {saida.armazem.nome}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">
                    Total de Itens:
                  </span>
                  <span className="text-foreground">
                    {saida.detalhes.reduce(
                      (acc, detalhe) => acc + detalhe.quantidade,
                      0
                    )}{" "}
                    unidades
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Box className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">
                    ID da Saída:
                  </span>
                  <span className="text-foreground">
                    #{saida.id}
                  </span>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                Lista de Produtos
              </h3>

              <div className="overflow-hidden rounded-md border border-border">
                <DataTable>
                  <DataTableHeader>
                    <DataTableRow className="hover:bg-transparent">
                      <DataTableHead className="pl-4">Produto</DataTableHead>
                      <DataTableHead>SKU</DataTableHead>
                      <DataTableHead>Quantidade</DataTableHead>
                      <DataTableHead className="pr-4">Tipo</DataTableHead>
                    </DataTableRow>
                  </DataTableHeader>
                  <DataTableBody>
                    {saida.detalhes.map((detalhe) => (
                      <DataTableRow key={detalhe.id} className="group">
                        <DataTableCell className="pl-4">
                          <div className="font-medium text-foreground transition-colors group-hover:text-primary">
                            {detalhe.produto.nome}
                          </div>
                        </DataTableCell>
                        <DataTableCell className="text-muted-foreground">
                          {detalhe.produto.sku}
                        </DataTableCell>
                        <DataTableCell className="font-medium">
                          <Badge className="bg-info/10 text-info">
                            {detalhe.quantidade} un.
                          </Badge>
                        </DataTableCell>
                        <DataTableCell className="pr-4">
                          {detalhe.isKit ? (
                            <Badge variant="outline" className="bg-info/10 text-info">
                              <Package className="h-3 w-3 mr-1" />
                              Kit
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-success/10 text-success">
                              Produto
                            </Badge>
                          )}
                        </DataTableCell>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
