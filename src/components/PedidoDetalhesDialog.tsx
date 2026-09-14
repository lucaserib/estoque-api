import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatBRL } from "@/utils/currency";
import { useEffect, useState } from "react";
import { generatePedidoPDF } from "@/utils/pdf";
import { toast } from "@/components/ui/sonner";

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
  Clock,
  Truck,
  Package,
  MessageSquare,
  CheckCircle2,
  CreditCard,
  X,
  FileDown,
  Loader2,
} from "lucide-react";
import { Pedido } from "@/app/(root)/gestao-pedidos/types";

interface PedidoDetalhesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  pedido: Pedido;
  calcularValorPedido: (produtos: Pedido["produtos"]) => number;
}

export function PedidoDetalhesDialog({
  isOpen,
  onClose,
  pedido,
  calcularValorPedido,
}: PedidoDetalhesDialogProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const valorTotal = calcularValorPedido(pedido.produtos);

  const handleDownloadPDF = async () => {
    setIsDownloading(true);

    try {
      await generatePedidoPDF(pedido);
      toast.success(`PDF do Pedido #${pedido.id} gerado com sucesso!`);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar PDF. Por favor, tente novamente.");
    } finally {
      setIsDownloading(false);
    }
  };
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
      <DialogContent
        className="max-w-3xl max-h-[90vh] p-0 gap-0 bg-card/95 border border-border shadow-xl rounded-xl"
        onEscapeKeyDown={onClose}
        onInteractOutside={onClose}
        onPointerDownOutside={onClose}
        aria-describedby="dialog-description"
      >
        <div className="sticky top-0 z-10 bg-card/90 border-b border-border rounded-t-xl">
          <DialogHeader className="p-6 pb-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                  <span className="text-primary text-sm">
                    #
                  </span>
                </span>
                Pedido #{pedido.id}
              </DialogTitle>
              <div className="flex items-center gap-2">
                {/* Botão para exportar PDF */}
                {pedido.status === "confirmado" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadPDF}
                    disabled={isDownloading}
                    className="h-8 gap-1 border-primary/30 text-primary hover:bg-primary/10"
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Exportando...</span>
                      </>
                    ) : (
                      <>
                        <FileDown className="h-4 w-4" />
                        <span>Baixar PDF</span>
                      </>
                    )}
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
          <div className="p-6 pt-2" id="dialog-description">
            {/* Status Badge */}
            <div className="mb-4">
              <Badge
                className={`px-3 py-1 ${
                  pedido.status === "confirmado"
                    ? "bg-success/10 text-success"
                    : "bg-warning/10 text-warning"
                }`}
              >
                {pedido.status === "confirmado" ? (
                  <CheckCircle2 className="mr-1 h-4 w-4" />
                ) : (
                  <Clock className="mr-1 h-4 w-4" />
                )}
                {pedido.status === "confirmado" ? "Concluído" : "Pendente"}
              </Badge>
            </div>

            {/* Informações gerais */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-background p-4 rounded-lg border border-border">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">
                    Fornecedor:
                  </span>
                  <span className="text-foreground">
                    {pedido.fornecedor.nome}
                  </span>
                </div>

                {pedido.dataPrevista && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-foreground">
                      Data prevista:
                    </span>
                    <span className="text-foreground">
                      {format(new Date(pedido.dataPrevista), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                )}

                {pedido.dataConclusao && (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span className="font-medium text-foreground">
                      Data de conclusão:
                    </span>
                    <span className="text-foreground">
                      {format(new Date(pedido.dataConclusao), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">
                    Produtos:
                  </span>
                  <span className="text-foreground">
                    {pedido.produtos.length} itens
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">
                    Valor total:
                  </span>
                  <span className="text-success font-medium">
                    {formatBRL(valorTotal)}
                  </span>
                </div>

                <div className="flex items-start gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <span className="font-medium text-foreground">
                    Comentários:
                  </span>
                  <span className="text-foreground">
                    {pedido.comentarios || (
                      <span className="text-muted-foreground italic">
                        Nenhum comentário
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Tabela de produtos */}
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
                      <DataTableHead className="text-right">Qtd</DataTableHead>
                      <DataTableHead className="text-right">Custo Unit.</DataTableHead>
                      <DataTableHead className="text-right">Mult.</DataTableHead>
                      <DataTableHead className="pr-4 text-right">Subtotal</DataTableHead>
                    </DataTableRow>
                  </DataTableHeader>
                  <DataTableBody>
                    {pedido.produtos.map((produto) => {
                      const multiplicador =
                        produto.multiplicador ||
                        produto.produto?.multiplicador ||
                        1;
                      const subtotal =
                        produto.quantidade * produto.custo * multiplicador;

                      return (
                        <DataTableRow key={produto.produtoId}>
                          <DataTableCell className="pl-4">
                            <div className="font-medium text-foreground">
                              {produto.produto?.nome ||
                                "Produto não encontrado"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              SKU: {produto.produto?.sku || "N/A"}
                            </div>
                          </DataTableCell>
                          <DataTableCell numeric emphasis>
                            {produto.quantidade}
                          </DataTableCell>
                          <DataTableCell numeric className="text-muted-foreground">
                            {formatBRL(produto.custo)}
                          </DataTableCell>
                          <DataTableCell numeric className="text-muted-foreground">
                            {multiplicador}x
                          </DataTableCell>
                          <DataTableCell numeric className="pr-4 font-medium text-success">
                            {formatBRL(subtotal)}
                          </DataTableCell>
                        </DataTableRow>
                      );
                    })}

                    {/* Linha do total */}
                    <DataTableRow className="bg-muted font-medium hover:bg-muted">
                      <DataTableCell colSpan={4} className="pl-4 text-right text-foreground">
                        Total do Pedido:
                      </DataTableCell>
                      <DataTableCell numeric className="pr-4 font-bold text-success">
                        {formatBRL(valorTotal)}
                      </DataTableCell>
                    </DataTableRow>
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
