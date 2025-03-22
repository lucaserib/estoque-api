"use client";

import { useEffect, useState, useCallback } from "react";
import { DateRange } from "react-day-picker";
import { toast } from "sonner";
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
import { AlertCircle, RefreshCw, PlusCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Armazem, Pedido } from "@/app/(root)/gestao-pedidos/types";
import { PedidoLoadingSkeleton } from "./PedidoLoadingSkeleton";
import { PedidoRow } from "./PedidoRow";
import { PedidoPagination } from "./PedidoPagination";
import { PedidoDetalhesDialog } from "./PedidoDetalhesDialog";
import { PedidoConfirmDialog } from "./PedidoConfirmDialog";
import Link from "next/link";

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

      // Filtrar por data apenas se houver um intervalo selecionado
      if (dateRange?.from && dateRange?.to) {
        const fromDate = new Date(dateRange.from);
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999);

        filteredPedidos = filteredPedidos.filter((pedido: Pedido) => {
          const pedidoDate = pedido.dataPrevista
            ? new Date(pedido.dataPrevista)
            : pedido.dataConclusao
            ? new Date(pedido.dataConclusao)
            : null;

          if (!pedidoDate) return true;
          return pedidoDate >= fromDate && pedidoDate <= toDate;
        });
      }

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
      setCurrentPage(1);
    } catch (error) {
      console.error("Erro ao buscar pedidos:", error);
      setError("Não foi possível carregar os pedidos. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [status, dateRange, searchTerm]);

  useEffect(() => {
    fetchPedidos();
  }, [fetchPedidos]);

  const calcularValorPedido = (produtos: Pedido["produtos"]) => {
    return produtos.reduce((total, produto) => {
      const valor =
        produto.quantidade *
        produto.custo *
        (produto.multiplicador || produto.produto?.multiplicador || 1);
      return total + valor;
    }, 0);
  };

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
      toast.success(`Pedido #${id} excluído com sucesso`);
    } catch (error) {
      console.error("Erro ao excluir pedido:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao excluir pedido. Tente novamente."
      );
    } finally {
      setLoadingAction(null);
    }
  };

  const handleConfirmSuccess = (pedidoId: number, novoPedidoId?: number) => {
    setIsConfirmOpen(false);

    let message = `Pedido #${pedidoId} confirmado com sucesso!`;
    if (novoPedidoId) {
      message += ` Um novo pedido #${novoPedidoId} foi criado para os itens não recebidos.`;
    }

    toast.success(message);
    fetchPedidos();

    if (onRefresh) {
      onRefresh();
    }
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = data.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(data.length / itemsPerPage);

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  const handleViewDetails = (pedido: Pedido) => {
    setSelectedPedido(pedido);
    setIsDetailsOpen(true);
  };

  const handleConfirmPedido = (pedido: Pedido) => {
    setSelectedPedido(pedido);
    setIsConfirmOpen(true);
  };

  if (loading) {
    return <PedidoLoadingSkeleton />;
  }

  if (error) {
    return (
      <Alert variant="destructive" className="animate-fade-in">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchPedidos}
          className="ml-auto"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Tentar novamente
        </Button>
      </Alert>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="w-full border-dashed border-2 bg-gray-50/50 dark:bg-gray-900/10 shadow-sm animate-fade-in">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-xl font-semibold text-gray-700 dark:text-gray-300">
            Nenhum pedido {status === "pendente" ? "pendente" : "concluído"}
          </CardTitle>
          <CardDescription>
            {status === "pendente"
              ? "Crie um novo pedido de compra para começar"
              : "Confirme seus pedidos pendentes para vê-los aqui"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center pb-0">
          {status === "pendente" ? (
            <Link href="/gestao-pedidos">
              <Button className="bg-indigo-600 hover:bg-indigo-700">
                <PlusCircle className="mr-2 h-4 w-4" />
                Novo Pedido
              </Button>
            </Link>
          ) : (
            <Button variant="outline" onClick={fetchPedidos}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
          )}
        </CardContent>
        <CardFooter className="opacity-70 pt-6 pb-8 px-8 text-center text-sm">
          <div className="mx-auto max-w-md">
            {status === "pendente"
              ? "Os pedidos pendentes mostram todos os pedidos que ainda não foram recebidos. Você pode confirmar recebimentos parciais e um novo pedido será criado automaticamente para os itens restantes."
              : "Os pedidos concluídos mostram todo o histórico de pedidos recebidos no sistema."}
          </div>
        </CardFooter>
      </Card>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <Card className="w-full border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
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

      {selectedPedido && (
        <PedidoDetalhesDialog
          isOpen={isDetailsOpen}
          onClose={() => setIsDetailsOpen(false)}
          pedido={selectedPedido}
          calcularValorPedido={calcularValorPedido}
        />
      )}

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
