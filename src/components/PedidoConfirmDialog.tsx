import { useState, useEffect } from "react";
import { formatBRL } from "@/utils/currency";

// UI Components
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  Warehouse,
  Package,
  AlertTriangle,
  X,
  Save,
  Loader2,
  MinusCircle,
  Barcode,
  ScanLine,
} from "lucide-react";
import { Armazem, Pedido } from "@/app/(root)/gestao-pedidos/types";
import { ScrollArea } from "./ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BarcodeScannerConferencia from "./BarcodeScannerConferencia";
import BarcodeReaderButton from "./BarcodeReaderButton";

interface PedidoConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  pedido: Pedido;
  armazens: Armazem[];
  onSuccess: (pedidoId: number, novoPedidoId?: number) => void;
}

interface Produto {
  id: string;
  nome: string;
  sku: string;
  codigosDeBarras?: {
    id: string;
    codigo: string;
    tipo: string;
  }[];
  ean?: string | number; // Campo legado para compatibilidade
  codigoEAN?: string; // Campo legado para compatibilidade
}

// Adicione o utilitário fora do componente principal para poder ser reutilizado
const getCodigoEAN = (produto: Produto): string | undefined => {
  // Se já tiver codigoEAN, retorna
  if (produto?.codigoEAN) {
    return produto.codigoEAN;
  }

  // Se tiver ean como BigInt (ou string, após serialização), converte para string
  if (produto?.ean) {
    return produto.ean.toString();
  }

  // Verifica codigosDeBarras
  if (produto.codigosDeBarras && Array.isArray(produto.codigosDeBarras)) {
    const codigoEAN = produto.codigosDeBarras.find(
      (codigo) => codigo.tipo === "EAN" || codigo.tipo === "GTIN"
    );
    if (codigoEAN) return codigoEAN.codigo;
  }

  // Senão, retorna undefined
  return undefined;
};

export function PedidoConfirmDialog({
  isOpen,
  onClose,
  pedido,
  armazens,
  onSuccess,
}: PedidoConfirmDialogProps) {
  const [armazemId, setArmazemId] = useState<string>("");
  const [comentarios, setComentarios] = useState<string>(
    pedido.comentarios || ""
  );
  const [produtos, setProdutos] = useState(
    pedido.produtos.map((produto) => ({
      produtoId: produto.produtoId,
      quantidade: produto.quantidade,
      custo: produto.custo,
      multiplicador:
        produto.multiplicador || produto.produto?.multiplicador || 1,
      produto: produto.produto,
    }))
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modoConferencia, setModoConferencia] = useState<"manual" | "barcode">(
    "manual"
  );

  useEffect(() => {
    return () => {
      if (!isOpen) {
        setTimeout(() => {
          document.body.focus();
        }, 0);
      }
    };
  }, [isOpen]);

  const hasMenorQuantidade = () => {
    return produtos.some(
      (produto, index) => produto.quantidade < pedido.produtos[index].quantidade
    );
  };

  const handleQuantityChange = (produtoId: string, value: number) => {
    setProdutos(
      produtos.map((produto) =>
        produto.produtoId === produtoId
          ? { ...produto, quantidade: value }
          : produto
      )
    );
  };

  const handleCostChange = (produtoId: string, value: number) => {
    setProdutos(
      produtos.map((produto) =>
        produto.produtoId === produtoId ? { ...produto, custo: value } : produto
      )
    );
  };

  const calcularValorTotal = () => {
    return produtos.reduce((total, produto) => {
      const subtotal =
        produto.quantidade * produto.custo * (produto.multiplicador || 1);
      return total + subtotal;
    }, 0);
  };

  const handleSubmit = async () => {
    if (!armazemId) {
      setError("Selecione um armazém para receber os produtos");
      return;
    }

    if (produtos.some((p) => p.quantidade < 0)) {
      setError("A quantidade não pode ser negativa");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/pedidos-compra", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pedidoId: pedido.id,
          armazemId,
          produtosRecebidos: produtos,
          comentarios,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Ocorreu um erro ao confirmar o pedido");
      }

      onSuccess(pedido.id, data.novoPedidoId);
    } catch (error) {
      console.error("Erro ao confirmar pedido:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Ocorreu um erro ao confirmar o pedido"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          // Important fix: Ensure we focus on a neutral element before closing
          document.body.focus();
          setTimeout(() => {
            onClose();
          }, 0);
        }
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 gap-0 bg-white/95 dark:bg-gray-900/95 border border-gray-200 dark:border-gray-700 shadow-xl rounded-xl backdrop-blur-md">
        <div className="sticky top-0 z-10 backdrop-blur-md bg-white/90 dark:bg-gray-900/90 border-b border-gray-200 dark:border-gray-800 rounded-t-xl">
          <DialogHeader className="p-6 pb-3">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-gray-800 dark:text-gray-100">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                Confirmar Recebimento - Pedido #{pedido.id}
              </DialogTitle>

              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                disabled={isSubmitting}
                className="h-8 w-8 rounded-full border border-gray-200 dark:border-gray-700"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          {/* Abas de modo de conferência */}
          <div className="px-6 pb-4">
            <Tabs
              value={modoConferencia}
              onValueChange={(valor) =>
                setModoConferencia(valor as "manual" | "barcode")
              }
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger
                  value="manual"
                  className="flex items-center gap-1.5"
                >
                  <Package className="h-4 w-4" />
                  Conferência Manual
                </TabsTrigger>
                <TabsTrigger
                  value="barcode"
                  className="flex items-center gap-1.5"
                >
                  <Barcode className="h-4 w-4" />
                  Código de Barras
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <ScrollArea className="max-h-[calc(90vh-11rem)]">
          <div className="p-6 pt-2 space-y-6">
            {/* Mensagem informativa */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800 p-3 text-sm text-blue-700 dark:text-blue-300">
              <div className="flex gap-2">
                <AlertTriangle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <div>
                  <p className="font-medium">Informação</p>
                  <p>
                    Preencha as quantidades recebidas e selecione o armazém de
                    destino. Se receber menos itens que o pedido original, um
                    novo pedido será criado automaticamente para os itens
                    faltantes.
                  </p>
                </div>
              </div>
            </div>

            {/* Erro */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
                <div className="flex gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Erro</p>
                    <p>{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Seleção de armazém e comentários */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300  items-center gap-1">
                  <Warehouse className="h-4 w-4 text-gray-500" />
                  Armazém de Destino <span className="text-red-500">*</span>
                </label>
                <Select onValueChange={setArmazemId} value={armazemId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione um armazém" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Armazéns</SelectLabel>
                      {armazens.map((armazem) => (
                        <SelectItem key={armazem.id} value={armazem.id}>
                          {armazem.nome}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {!armazemId && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    Selecione um armazém para confirmar o pedido
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Comentários (opcional)
                </label>
                <Textarea
                  value={comentarios}
                  onChange={(e) => setComentarios(e.target.value)}
                  placeholder="Adicione observações sobre o recebimento"
                  className="resize-none min-h-[80px]"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Conteúdo baseado no modo selecionado */}
            {modoConferencia === "manual" ? (
              /* Tabela de produtos - Modo Manual */
              <div>
                <div className="flex items-center justify-between mb-3 mt-6">
                  <h3 className="font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <Package className="h-4 w-4 text-indigo-500" />
                    Produtos Recebidos
                  </h3>

                  {hasMenorQuantidade() && (
                    <div className="flex items-center gap-1 text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 py-1 px-2 rounded-full border border-amber-200 dark:border-amber-800">
                      <AlertTriangle className="h-3 w-3" />
                      <span>
                        Itens faltantes serão adicionados a um novo pedido
                      </span>
                    </div>
                  )}
                </div>

                <div className="overflow-hidden rounded-md border border-gray-200 dark:border-gray-700">
                  <Table>
                    <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
                      <TableRow>
                        <TableHead className="font-medium">Produto</TableHead>
                        <TableHead className="font-medium text-center w-24">
                          Qtd. Pedida
                        </TableHead>
                        <TableHead className="font-medium text-center w-28">
                          Qtd. Recebida
                        </TableHead>
                        <TableHead className="font-medium text-right w-32">
                          Custo Unit.
                        </TableHead>
                        <TableHead className="font-medium text-right w-24">
                          Mult.
                        </TableHead>
                        <TableHead className="font-medium text-right w-32">
                          Subtotal
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {produtos.map((produto, index) => {
                        const originalProduto = pedido.produtos[index];
                        const subtotal =
                          produto.quantidade *
                          produto.custo *
                          (produto.multiplicador || 1);
                        const isLessQuantity =
                          produto.quantidade < originalProduto.quantidade;

                        return (
                          <TableRow
                            key={produto.produtoId}
                            className="hover:bg-gray-50 dark:hover:bg-gray-800/70 group"
                          >
                            <TableCell>
                              <div
                                className="font-medium text-gray-800 dark:text-gray-200 truncate max-w-[180px]"
                                title={produto.produto?.nome}
                              >
                                {produto.produto?.nome ||
                                  "Produto não encontrado"}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                <span>
                                  SKU: {produto.produto?.sku || "N/A"}
                                </span>
                                {produto.produto &&
                                getCodigoEAN(produto.produto) ? (
                                  <span className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                                    <Barcode className="h-3 w-3" />
                                    {getCodigoEAN(produto.produto)}
                                  </span>
                                ) : (
                                  <span className="text-amber-500 dark:text-amber-400 text-xs italic">
                                    Sem código de barras
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-medium text-gray-500 dark:text-gray-400">
                              {originalProduto.quantidade}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-1">
                                <Input
                                  type="number"
                                  min="0"
                                  value={produto.quantidade}
                                  onChange={(e) =>
                                    handleQuantityChange(
                                      produto.produtoId,
                                      parseInt(e.target.value) || 0
                                    )
                                  }
                                  className={`w-16 text-center ${
                                    isLessQuantity
                                      ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20"
                                      : ""
                                  }`}
                                  disabled={isSubmitting}
                                />
                                {produto.produto &&
                                  getCodigoEAN(produto.produto) && (
                                    <BarcodeReaderButton
                                      onScan={(barcode) => {
                                        const produtoEAN = produto.produto
                                          ? getCodigoEAN(produto.produto)
                                          : undefined;
                                        if (
                                          produtoEAN &&
                                          barcode === produtoEAN
                                        ) {
                                          handleQuantityChange(
                                            produto.produtoId,
                                            produto.quantidade + 1
                                          );
                                        }
                                      }}
                                      buttonLabel=""
                                      buttonVariant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 transition-colors"
                                      validateBarcode={(barcode) => {
                                        return !!(
                                          produto.produto &&
                                          barcode ===
                                            getCodigoEAN(produto.produto)
                                        );
                                      }}
                                    />
                                  )}
                              </div>
                              {isLessQuantity && (
                                <div className="flex items-center justify-center gap-1 text-xs text-amber-600 dark:text-amber-400 mt-1">
                                  <MinusCircle className="h-3 w-3" />
                                  {originalProduto.quantidade -
                                    produto.quantidade}{" "}
                                  faltantes
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={(produto.custo / 100).toFixed(2)}
                                onChange={(e) =>
                                  handleCostChange(
                                    produto.produtoId,
                                    Math.round(parseFloat(e.target.value) * 100)
                                  )
                                }
                                className="w-24 text-right ml-auto"
                                disabled={isSubmitting}
                              />
                            </TableCell>
                            <TableCell className="text-right text-gray-600 dark:text-gray-300 font-medium">
                              {produto.multiplicador}x
                            </TableCell>
                            <TableCell className="text-right font-medium text-green-600 dark:text-green-400">
                              {formatBRL(subtotal)}
                            </TableCell>
                          </TableRow>
                        );
                      })}

                      <TableRow className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
                        <TableCell
                          colSpan={5}
                          className="text-right text-gray-700 dark:text-gray-300 font-semibold"
                        >
                          Total do Pedido:
                        </TableCell>
                        <TableCell className="text-right font-bold text-green-600 dark:text-green-400">
                          {formatBRL(calcularValorTotal())}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              /* Modo de Código de Barras */
              <BarcodeScannerConferencia
                produtos={produtos}
                onQuantidadeAtualizada={handleQuantityChange}
                onVoltarModoManual={() => setModoConferencia("manual")}
              />
            )}
          </div>
          <DialogFooter className="sticky bottom-0 backdrop-blur-md bg-white/90 dark:bg-gray-900/90 border-t border-gray-200 dark:border-gray-800 p-4 rounded-b-xl flex justify-between w-full">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !armazemId}
              className="gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Confirmar Recebimento
                </>
              )}
            </Button>
          </DialogFooter>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
