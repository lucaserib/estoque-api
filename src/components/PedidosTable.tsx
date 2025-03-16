"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { formatBRL } from "@/utils/currency";

// UI Components
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  MoreHorizontal,
  Trash2,
  Loader2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import ConfirmarPedidoForm from "./ConfirmarPedidoForm";
import { Badge } from "@/components/ui/badge";

// Defina os tipos
interface Fornecedor {
  id: string;
  nome: string;
}

interface Produto {
  id: string;
  nome: string;
  sku: string;
  multiplicador?: number;
}

interface PedidoProduto {
  produtoId: string;
  quantidade: number;
  custo: number;
  multiplicador?: number;
  produto?: Produto;
}

interface Pedido {
  id: number;
  fornecedor: Fornecedor;
  produtos: PedidoProduto[];
  comentarios: string;
  status: string;
  dataPrevista?: string;
  armazemId?: string;
  dataConclusao?: string;
}

interface PedidosTableProps {
  status: string;
  dateRange?: DateRange;
  searchTerm?: string;
  onRefresh?: () => void;
}

const PedidosTable = ({
  status,
  dateRange,
  searchTerm,
  onRefresh,
}: PedidosTableProps) => {
  const [data, setData] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [loadingAction, setLoadingAction] = useState<number | null>(null);
  const [armazens, setArmazens] = useState<{ id: string; nome: string }[]>([]);
  const itemsPerPage = 10;

  // Carregar dados de armazéns
  useEffect(() => {
    const fetchArmazens = async () => {
      try {
        const response = await fetch("/api/estoque/criarArmazem");
        if (!response.ok) throw new Error("Falha ao carregar armazéns");
        const data = await response.json();
        setArmazens(data);
      } catch (error) {
        console.error("Erro ao carregar armazéns:", error);
      }
    };

    fetchArmazens();
  }, []);

  // Função para buscar pedidos com filtros
  const fetchPedidos = async () => {
    setLoading(true);
    setError(null);

    try {
      let url = `/api/pedidos-compra`;

      const response = await fetch(url);
      if (!response.ok) throw new Error("Falha ao carregar pedidos");

      const allPedidos = await response.json();

      // Filtrar pedidos pelo status
      let filteredPedidos = allPedidos.filter(
        (pedido: Pedido) => pedido.status === status
      );

      // Aplicar filtro de data
      if (dateRange?.from && dateRange?.to) {
        const fromDate = new Date(dateRange.from);
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999); // Fim do dia

        filteredPedidos = filteredPedidos.filter((pedido: Pedido) => {
          const pedidoDate = pedido.dataPrevista
            ? new Date(pedido.dataPrevista)
            : pedido.dataConclusao
            ? new Date(pedido.dataConclusao)
            : new Date(0);

          return pedidoDate >= fromDate && pedidoDate <= toDate;
        });
      }

      // Aplicar filtro de pesquisa
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filteredPedidos = filteredPedidos.filter(
          (pedido: Pedido) =>
            pedido.fornecedor.nome.toLowerCase().includes(term) ||
            pedido.id.toString().includes(term) ||
            (pedido.comentarios &&
              pedido.comentarios.toLowerCase().includes(term))
        );
      }

      setData(filteredPedidos);
    } catch (error) {
      console.error("Erro ao buscar pedidos:", error);
      setError("Não foi possível carregar os pedidos. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  // Buscar pedidos quando os filtros mudam
  useEffect(() => {
    fetchPedidos();
  }, [status, dateRange, searchTerm]);

  // Calcular valor total do pedido
  const calcularValorPedido = (produtos: PedidoProduto[]) => {
    return produtos.reduce((total, produto) => {
      const valor =
        produto.quantidade *
        produto.custo *
        (produto.multiplicador || produto.produto?.multiplicador || 1);
      return total + valor;
    }, 0);
  };

  // Deletar pedido
  const handleDeletePedido = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir este pedido?")) return;

    setLoadingAction(id);

    try {
      const response = await fetch("/api/pedidos-compra", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedidoId: id }),
      });

      if (!response.ok) throw new Error("Falha ao excluir pedido");

      // Atualizar a lista após exclusão
      setData(data.filter((pedido) => pedido.id !== id));
    } catch (error) {
      console.error("Erro ao excluir pedido:", error);
      alert("Erro ao excluir pedido. Tente novamente.");
    } finally {
      setLoadingAction(null);
    }
  };

  // Paginação
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = data.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(data.length / itemsPerPage);

  const paginate = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  // Se estiver carregando, mostrar esqueleto
  if (loading) {
    return (
      <div className="space-y-3">
        <Card className="w-full border-gray-200 dark:border-gray-800">
          <CardContent className="p-6">
            <div className="flex flex-col space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <div className="flex items-center justify-center my-4">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
                <span className="ml-2 text-gray-600 dark:text-gray-400">
                  Carregando pedidos...
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Se houver erro, mostrar mensagem
  if (error) {
    return (
      <Card className="w-full bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertCircle size={18} />
            Erro ao carregar pedidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </CardContent>
        <CardFooter>
          <Button
            variant="outline"
            onClick={fetchPedidos}
            className="border-red-200 text-red-700 hover:bg-red-100 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
          >
            Tentar novamente
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Se não houver dados, mostrar mensagem
  if (data.length === 0) {
    return (
      <Card className="w-full bg-gray-50 dark:bg-gray-900/50 border-dashed border-gray-300 dark:border-gray-700">
        <CardHeader className="text-center">
          <CardTitle className="text-xl font-semibold text-gray-700 dark:text-gray-300">
            Nenhum pedido {status === "pendente" ? "pendente" : "concluído"}{" "}
            encontrado
          </CardTitle>
          <CardDescription className="text-gray-500 dark:text-gray-400">
            {status === "pendente"
              ? "Crie um novo pedido de compra para começar."
              : "Confirme seus pedidos pendentes para vê-los aqui."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Renderizar a tabela
  return (
    <div className="space-y-4">
      <Card className="w-full border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-100 dark:bg-gray-800">
              <TableRow>
                <TableHead className="font-medium">Pedido #</TableHead>
                <TableHead className="font-medium">Fornecedor</TableHead>
                <TableHead className="font-medium text-center">
                  Produtos
                </TableHead>
                <TableHead className="font-medium">Valor Total</TableHead>
                <TableHead className="font-medium">
                  {status === "pendente" ? "Data Prevista" : "Data Conclusão"}
                </TableHead>
                <TableHead className="font-medium text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentItems.map((pedido) => (
                <TableRow
                  key={pedido.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <TableCell className="font-medium">#{pedido.id}</TableCell>
                  <TableCell>{pedido.fornecedor.nome}</TableCell>
                  <TableCell className="text-center">
                    {pedido.produtos.length}
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatBRL(calcularValorPedido(pedido.produtos) * 100)}
                  </TableCell>
                  <TableCell>
                    {(
                      status === "pendente"
                        ? pedido.dataPrevista
                        : pedido.dataConclusao
                    ) ? (
                      format(
                        new Date(
                          status === "pendente"
                            ? pedido.dataPrevista!
                            : pedido.dataConclusao!
                        ),
                        "dd/MM/yyyy",
                        { locale: ptBR }
                      )
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400">
                        Não definida
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            {loadingAction === pedido.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="h-4 w-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-md"
                        >
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedPedido(pedido);
                              setIsDetailsOpen(true);
                            }}
                            className="flex items-center cursor-pointer"
                          >
                            <Eye className="mr-2 h-4 w-4 text-indigo-500" /> Ver
                            detalhes
                          </DropdownMenuItem>

                          {status === "pendente" && (
                            <>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedPedido(pedido);
                                  setIsConfirmOpen(true);
                                }}
                                className="flex items-center cursor-pointer"
                              >
                                <Check className="mr-2 h-4 w-4 text-green-500" />{" "}
                                Confirmar
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() => handleDeletePedido(pedido.id)}
                                className="flex items-center cursor-pointer"
                              >
                                <Trash2 className="mr-2 h-4 w-4 text-red-500" />{" "}
                                Excluir
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Mostrando {indexOfFirstItem + 1}-
            {Math.min(indexOfLastItem, data.length)} de {data.length} pedido(s)
          </div>
          <div className="flex items-center space-x-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => paginate(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="h-8 w-8 p-0 border-gray-200 dark:border-gray-700"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
              const pageNum = i + 1;
              const isVisible =
                pageNum === 1 ||
                pageNum === totalPages ||
                (pageNum >= currentPage - 1 && pageNum <= currentPage + 1);

              if (!isVisible && pageNum === 2) {
                return (
                  <span key="ellipsis-start" className="px-2">
                    ...
                  </span>
                );
              }

              if (!isVisible && pageNum === totalPages - 1) {
                return (
                  <span key="ellipsis-end" className="px-2">
                    ...
                  </span>
                );
              }

              if (!isVisible) return null;

              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="sm"
                  onClick={() => paginate(pageNum)}
                  className={`h-8 w-8 p-0 ${
                    currentPage === pageNum
                      ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                >
                  {pageNum}
                </Button>
              );
            })}

            <Button
              variant="outline"
              size="sm"
              onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="h-8 w-8 p-0 border-gray-200 dark:border-gray-700"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Modal de Detalhes */}
      {selectedPedido && (
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-gray-800 dark:text-gray-100">
                <span className="h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                  <span className="text-indigo-600 dark:text-indigo-400 text-sm">
                    #
                  </span>
                </span>
                Detalhes do Pedido #{selectedPedido.id}
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
              <div className="space-y-2">
                <div>
                  <span className="font-semibold">Fornecedor:</span>{" "}
                  {selectedPedido.fornecedor.nome}
                </div>
                <div>
                  <span className="font-semibold">Status:</span>{" "}
                  <Badge
                    className={
                      selectedPedido.status === "confirmado"
                        ? "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300"
                        : "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300"
                    }
                  >
                    {selectedPedido.status === "confirmado"
                      ? "Concluído"
                      : "Pendente"}
                  </Badge>
                </div>
                {selectedPedido.dataPrevista && (
                  <div>
                    <span className="font-semibold">Data prevista:</span>{" "}
                    {format(
                      new Date(selectedPedido.dataPrevista),
                      "dd/MM/yyyy",
                      { locale: ptBR }
                    )}
                  </div>
                )}
                {selectedPedido.dataConclusao && (
                  <div>
                    <span className="font-semibold">Data de conclusão:</span>{" "}
                    {format(
                      new Date(selectedPedido.dataConclusao),
                      "dd/MM/yyyy",
                      { locale: ptBR }
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div>
                  <span className="font-semibold">Comentários:</span>{" "}
                  {selectedPedido.comentarios || (
                    <span className="text-gray-400">Nenhum comentário</span>
                  )}
                </div>
                <div>
                  <span className="font-semibold">Valor total:</span>{" "}
                  {formatBRL(
                    calcularValorPedido(selectedPedido.produtos) * 100
                  )}
                </div>
              </div>
            </div>

            <Card className="w-full border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gray-100 dark:bg-gray-800">
                    <TableRow>
                      <TableHead className="font-medium">Produto</TableHead>
                      <TableHead className="font-medium text-right">
                        Quantidade
                      </TableHead>
                      <TableHead className="font-medium text-right">
                        Custo Unitário
                      </TableHead>
                      <TableHead className="font-medium text-right">
                        Multiplicador
                      </TableHead>
                      <TableHead className="font-medium text-right">
                        Subtotal
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPedido.produtos.map((produto) => {
                      const multiplicador =
                        produto.multiplicador ||
                        produto.produto?.multiplicador ||
                        1;
                      const subtotal =
                        produto.quantidade * produto.custo * multiplicador;

                      return (
                        <TableRow
                          key={produto.produtoId}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        >
                          <TableCell>
                            <div className="font-medium">
                              {produto.produto?.nome ||
                                "Produto não encontrado"}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              SKU: {produto.produto?.sku || "N/A"}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {produto.quantidade}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatBRL(produto.custo)}
                          </TableCell>
                          <TableCell className="text-right">
                            {multiplicador}x
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatBRL(subtotal)}
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {/* Linha do total */}
                    <TableRow className="bg-gray-50 dark:bg-gray-900/50 font-medium">
                      <TableCell colSpan={4} className="text-right">
                        Valor Total:
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatBRL(
                          calcularValorPedido(selectedPedido.produtos)
                        )}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </Card>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de Confirmação de Pedido */}
      {selectedPedido && (
        <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-gray-800 dark:text-gray-100">
                <span className="h-6 w-6 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                  <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                </span>
                Confirmar Recebimento do Pedido #{selectedPedido.id}
              </DialogTitle>
            </DialogHeader>

            <ConfirmarPedidoForm
              pedido={selectedPedido}
              armazens={armazens}
              onSuccess={() => {
                setIsConfirmOpen(false);
                fetchPedidos();
                if (onRefresh) onRefresh();
              }}
              onCancel={() => setIsConfirmOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default PedidosTable;
