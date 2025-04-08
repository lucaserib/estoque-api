"use client";

import { useEffect, useState, useCallback } from "react";
import { DateRange } from "react-day-picker";
import { toast } from "@/components/ui/sonner";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertCircle,
  RefreshCw,
  PlusCircle,
  FileDown,
  Loader2,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Armazem, Pedido } from "@/app/(root)/gestao-pedidos/types";
import { PedidoLoadingSkeleton } from "./PedidoLoadingSkeleton";
import { PedidoRow } from "./PedidoRow";
import { PedidoPagination } from "./PedidoPagination";
import { PedidoDetalhesDialog } from "./PedidoDetalhesDialog";
import { PedidoConfirmDialog } from "./PedidoConfirmDialog";
import Link from "next/link";
import { generateMultiplePedidosPDF } from "@/utils/pdf";

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
  const [selectedPedidos, setSelectedPedidos] = useState<Set<number>>(
    new Set()
  );
  const [isDownloadingMultiple, setIsDownloadingMultiple] = useState(false);

  const itemsPerPage = 10;

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
      const params = new URLSearchParams();

      if (status) {
        params.append("status", status);
      }

      if (dateRange?.from) {
        params.append("startDate", dateRange.from.toISOString());
      }

      if (dateRange?.to) {
        const endDate = new Date(dateRange.to);
        endDate.setHours(23, 59, 59, 999);
        params.append("endDate", endDate.toISOString());
      }

      const url = `/api/pedidos-compra?${params.toString()}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Falha ao carregar pedidos");
      }

      let pedidos = await response.json();

      pedidos.forEach((pedido: Pedido) => {
        if (!pedido.produtos || pedido.produtos.length === 0) {
          console.warn(`Pedido #${pedido.id} não tem produtos associados`);
        } else {
          pedido.produtos.forEach((produto, index) => {
            if (
              produto.quantidade === undefined ||
              produto.quantidade === null
            ) {
              console.warn(
                `Produto #${index} do pedido #${pedido.id} não tem quantidade definida`
              );
            }
          });
        }
      });

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        pedidos = pedidos.filter(
          (pedido: Pedido) =>
            pedido.fornecedor?.nome?.toLowerCase().includes(term) ||
            pedido.id.toString().includes(term) ||
            pedido.produtos?.some(
              (p) =>
                p.produto?.nome?.toLowerCase().includes(term) ||
                p.produto?.sku?.toLowerCase().includes(term)
            ) ||
            (pedido.comentarios &&
              pedido.comentarios.toLowerCase().includes(term))
        );
      }

      setData(pedidos);
      setCurrentPage(1);
      setSelectedPedidos(new Set());
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
    if (!produtos || !Array.isArray(produtos)) return 0;

    return produtos.reduce((total, produto) => {
      if (!produto) return total;

      const quantidade = produto.quantidade || 0;
      const custo = produto.custo || 0;
      const multiplicador =
        produto.multiplicador ||
        (produto.produto && produto.produto.multiplicador) ||
        1;

      const valor = quantidade * custo * multiplicador;
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

      setData(data.filter((pedido) => pedido.id !== id));
      const updatedSelection = new Set(selectedPedidos);
      updatedSelection.delete(id);
      setSelectedPedidos(updatedSelection);

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

  const handleConfirmSuccess = () => {
    setIsConfirmOpen(false);
    if (onRefresh) onRefresh();
    fetchPedidos();
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

  const toggleSelectPedido = (pedidoId: number) => {
    const updatedSelection = new Set(selectedPedidos);
    if (updatedSelection.has(pedidoId)) {
      updatedSelection.delete(pedidoId);
    } else {
      updatedSelection.add(pedidoId);
    }
    setSelectedPedidos(updatedSelection);
  };

  const toggleSelectAll = () => {
    if (selectedPedidos.size === currentItems.length) {
      setSelectedPedidos(new Set());
    } else {
      const newSelection = new Set<number>();
      currentItems.forEach((pedido) => newSelection.add(pedido.id));
      setSelectedPedidos(newSelection);
    }
  };

  const handleDownloadSelected = async () => {
    if (selectedPedidos.size === 0) {
      toast.warning("Selecione pelo menos um pedido para baixar");
      return;
    }

    setIsDownloadingMultiple(true);

    const pedidosSelecionados = data.filter((pedido) =>
      selectedPedidos.has(pedido.id)
    );

    try {
      await generateMultiplePedidosPDF(pedidosSelecionados);
      toast.success(
        `Relatório com ${pedidosSelecionados.length} pedido(s) gerado com sucesso!`
      );
    } catch (error) {
      console.error("Erro ao gerar PDF dos pedidos selecionados:", error);
      toast.error(
        "Ocorreu um erro ao gerar o PDF. Por favor, tente novamente."
      );
    } finally {
      setIsDownloadingMultiple(false);
    }
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
      <div className="text-center p-8 bg-gray-50 rounded-md border border-gray-200">
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="rounded-full bg-gray-100 p-3">
            <AlertCircle className="h-6 w-6 text-gray-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">
            Nenhum pedido encontrado
          </h3>
          <p className="text-sm text-gray-500 max-w-sm">
            {status === "confirmado"
              ? "Não há pedidos concluídos para o período selecionado."
              : "Não há pedidos que correspondam aos critérios selecionados."}
          </p>
          <Link href="/gestao-pedidos/novo">
            <Button className="mt-2">
              <PlusCircle className="mr-2 h-4 w-4" /> Criar Novo Pedido
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Barra de ações para pedidos selecionados */}
      {status === "confirmado" && (
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {selectedPedidos.size} pedido(s) selecionado(s)
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadSelected}
            disabled={selectedPedidos.size === 0 || isDownloadingMultiple}
            className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800"
          >
            {isDownloadingMultiple ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <FileDown className="mr-2 h-4 w-4" />
                Baixar Selecionados
              </>
            )}
          </Button>
        </div>
      )}

      <Card className="w-full border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
              <TableRow>
                {status === "confirmado" && (
                  <TableHead className="w-10">
                    <div className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={
                          selectedPedidos.size === currentItems.length &&
                          currentItems.length > 0
                        }
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
                      />
                    </div>
                  </TableHead>
                )}
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
                  isSelected={
                    status === "confirmado"
                      ? selectedPedidos.has(pedido.id)
                      : false
                  }
                  onToggleSelect={
                    status === "confirmado"
                      ? () => toggleSelectPedido(pedido.id)
                      : () => {}
                  }
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
