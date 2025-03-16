"use client";

import { useEffect, useState, useCallback } from "react";
import { DateRange } from "react-day-picker";
import { formatBRL } from "@/utils/currency";

// Sub-componentes

// UI Components
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Armazem, Pedido } from "@/app/(root)/gestao-pedidos/types";
import { PedidoLoadingSkeleton } from "./PedidoLoadingSkeleton";
import { PedidoRow } from "./PedidoRow";
import { PedidoPagination } from "./PedidoPagination";
import { PedidoDetalhesDialog } from "./PedidoDetalhesDialog";
import { PedidoConfirmDialog } from "./PedidoConfirmDialog";

// Tipos

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
  const [armazens, setArmazens] = useState<Armazem[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
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

  const fetchPedidos = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/pedidos-compra`);

      if (!response.ok) {
        throw new Error("Falha ao carregar pedidos");
      }

      const allPedidos = await response.json();

      // Filtrar pedidos pelo status
      let filteredPedidos = allPedidos.filter(
        (pedido: Pedido) => pedido.status === status
      );

      console.log(
        `Pedidos ${
          status === "confirmado" ? "confirmados" : "pendentes"
        } encontrados:`,
        filteredPedidos.length
      );

      if (dateRange?.from && dateRange?.to) {
        const fromDate = new Date(dateRange.from);
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999); // Fim do dia

        filteredPedidos = filteredPedidos.filter((pedido: Pedido) => {
          const pedidoDate = pedido.dataPrevista
            ? new Date(pedido.dataPrevista)
            : pedido.dataConclusao
            ? new Date(pedido.dataConclusao)
            : null;

          // Se não houver data no pedido, mantém o pedido quando não há filtro de data
          if (!pedidoDate) return true;

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
            pedido.produtos.some(
              (p) =>
                p.produto?.nome?.toLowerCase().includes(term) ||
                p.produto?.sku?.toLowerCase().includes(term)
            ) ||
            (pedido.comentarios &&
              pedido.comentarios.toLowerCase().includes(term))
        );
      }

      setData(filteredPedidos);
      // Resetar para a primeira página quando os dados mudam
      setCurrentPage(1);
    } catch (error) {
      console.error("Erro ao buscar pedidos:", error);
      setError("Não foi possível carregar os pedidos. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [status, dateRange, searchTerm]);

  // Buscar pedidos quando os filtros mudam
  useEffect(() => {
    fetchPedidos();
  }, [fetchPedidos]);

  // Efeito para limpar mensagem de sucesso após 5 segundos
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Calcular valor total do pedido
  const calcularValorPedido = (produtos: Pedido["produtos"]) => {
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
    setError(null);

    try {
      const response = await fetch("/api/pedidos-compra", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedidoId: id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Falha ao excluir pedido");
      }

      // Atualizar a lista após exclusão
      setData(data.filter((pedido) => pedido.id !== id));
      setSuccessMessage(`Pedido #${id} excluído com sucesso`);
    } catch (error) {
      console.error("Erro ao excluir pedido:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Erro ao excluir pedido. Tente novamente."
      );
    } finally {
      setLoadingAction(null);
    }
  };

  // Confirmar pedido (callbacks)
  const handleConfirmSuccess = (pedidoId: number, novoPedidoId?: number) => {
    setIsConfirmOpen(false);

    let message = `Pedido #${pedidoId} confirmado com sucesso!`;
    if (novoPedidoId) {
      message += ` Um novo pedido #${novoPedidoId} foi criado para os itens não recebidos.`;
    }

    setSuccessMessage(message);
    fetchPedidos();

    if (onRefresh) {
      onRefresh();
    }
  };

  // Paginação
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = data.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(data.length / itemsPerPage);

  // Handler de paginação
  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  // Handlers de ações
  const handleViewDetails = (pedido: Pedido) => {
    setSelectedPedido(pedido);
    setIsDetailsOpen(true);
  };

  const handleConfirmPedido = (pedido: Pedido) => {
    setSelectedPedido(pedido);
    setIsConfirmOpen(true);
  };

  // Se estiver carregando, mostrar esqueleto
  if (loading) {
    return <PedidoLoadingSkeleton />;
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
        <CardFooter className="justify-center pb-6">
          <Button
            variant="outline"
            onClick={fetchPedidos}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Renderizar a tabela
  return (
    <div className="space-y-4">
      {/* Mensagem de sucesso */}
      {successMessage && (
        <Alert variant="success">
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

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
                <PedidoRow
                  key={pedido.id}
                  pedido={pedido}
                  status={status}
                  loadingAction={loadingAction === pedido.id}
                  onViewDetails={() => handleViewDetails(pedido)}
                  onConfirm={() => handleConfirmPedido(pedido)}
                  onDelete={() => handleDeletePedido(pedido.id)}
                  calcularValorPedido={calcularValorPedido}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Paginação */}
      {totalPages > 1 && (
        <PedidoPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          totalItems={data.length}
          itemsPerPage={itemsPerPage}
          currentFirstItem={indexOfFirstItem + 1}
          currentLastItem={Math.min(indexOfLastItem, data.length)}
        />
      )}

      {/* Modal de Detalhes */}
      {selectedPedido && (
        <PedidoDetalhesDialog
          isOpen={isDetailsOpen}
          onClose={() => setIsDetailsOpen(false)}
          pedido={selectedPedido}
          calcularValorPedido={calcularValorPedido}
        />
      )}

      {/* Modal de Confirmação de Pedido */}
      {selectedPedido && (
        <PedidoConfirmDialog
          isOpen={isConfirmOpen}
          onClose={() => setIsConfirmOpen(false)}
          pedido={selectedPedido}
          armazens={armazens}
          onSuccess={handleConfirmSuccess}
        />
      )}
    </div>
  );
};

export default PedidosTable;
