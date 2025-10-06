"use client";
import { useState, useEffect, useCallback } from "react";
import { Produto } from "../types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { ProdutoEstoqueDialog } from "./dialogs/ProdutoEstoqueDialog";
import { ProdutoPagination } from "./ProdutoPagination";
import { ProdutoDetalhesDialog } from "./dialogs/ProdutoDetalhesDialog";
import { ProdutoEditarDialog } from "./dialogs/ProdutoEditarDialog";
import { ProdutoFornecedorDialog } from "./dialogs/ProdutoFornecedorDialog";
import { ReposicaoModal } from "./ReposicaoModal";
import { ProdutoTableRow } from "./ProdutoTableRow";

interface ProdutoListProps {
  produtos: Produto[];
  onDelete: (id: string) => void;
  onEdit: (produto: Produto) => void;
  refreshTrigger?: number;
  onRefreshReplenishment?: () => void;
}

interface StockItem {
  produtoId: string;
  armazemId: string;
  quantidade: number;
  estoqueSeguranca?: number;
  armazem?: { id: string; nome: string };
}

const ProdutoList = ({
  produtos,
  onDelete,
  onEdit,
  refreshTrigger = 0,
  onRefreshReplenishment,
}: ProdutoListProps) => {
  const [filterOptions, setFilterOptions] = useState({
    searchTerm: "",
    stockFilter: "all" as "all" | "low" | "none" | "available",
  });
  const [selectedProduto, setSelectedProduto] = useState<Produto | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFornecedorModal, setShowFornecedorModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showReposicaoModal, setShowReposicaoModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingStock, setIsLoadingStock] = useState(false);
  const [stockDetails, setStockDetails] = useState<StockItem[]>([]);
  const [stockData, setStockData] = useState<{ [key: string]: number }>({});
  const [estoqueSegurancaData, setEstoqueSegurancaData] = useState<{
    [key: string]: number;
  }>({});
  const [replenishmentStatus, setReplenishmentStatus] = useState<{
    [key: string]: "ok" | "atencao" | "critico";
  }>({});
  const [lastReplenishmentFetch, setLastReplenishmentFetch] = useState<number>(0);
  const [isLoadingReplenishment, setIsLoadingReplenishment] = useState(false);
  const itemsPerPage = 10;
  const REPLENISHMENT_CACHE_TTL = 5 * 60 * 1000; // 5 minutos em milissegundos

  // Fetch stock data on mount and when produtos change OR refreshTrigger changes
  useEffect(() => {
    const fetchStockTotals = async () => {
      if (produtos.length === 0) return;

      try {
        const stockPromises = produtos.map(async (produto) => {
          const response = await fetch(`/api/estoque/produto/${produto.id}`);
          if (!response.ok) throw new Error("Erro ao buscar estoque");

          const stockItems: StockItem[] = await response.json();
          const totalQuantity = stockItems.reduce(
            (sum, item) => sum + item.quantidade,
            0
          );

          const estoqueSeguranca = stockItems.reduce(
            (sum, item) => Math.max(sum, item.estoqueSeguranca || 0),
            0
          );

          return {
            produtoId: produto.id,
            totalQuantity,
            estoqueSeguranca,
          };
        });

        const stockResults = await Promise.all(stockPromises);

        const stockMap = stockResults.reduce(
          (acc, { produtoId, totalQuantity }) => {
            acc[produtoId] = totalQuantity;
            return acc;
          },
          {} as { [key: string]: number }
        );

        const estoqueSegurancaMap = stockResults.reduce(
          (acc, { produtoId, estoqueSeguranca }) => {
            acc[produtoId] = estoqueSeguranca;
            return acc;
          },
          {} as { [key: string]: number }
        );

        setStockData(stockMap);
        setEstoqueSegurancaData(estoqueSegurancaMap);
      } catch (error) {
        console.error("Erro ao buscar estoque:", error);
      }
    };

    fetchStockTotals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtos.length, refreshTrigger]); // Refetch when produtos or refreshTrigger change

  // Função para buscar status de reposição com cache
  const fetchReplenishmentStatus = async (forceRefresh = false) => {
    const now = Date.now();
    const cacheValid = now - lastReplenishmentFetch < REPLENISHMENT_CACHE_TTL;

    // Se o cache ainda é válido e não é um refresh forçado, não faz nada
    if (cacheValid && !forceRefresh) {
      return;
    }

    setIsLoadingReplenishment(true);
    try {
      const statusPromises = produtos.map(async (produto) => {
        try {
          const response = await fetch(`/api/replenishment/suggestions/${produto.id}`);
          if (!response.ok) return { produtoId: produto.id, status: "ok" as const };
          const data = await response.json();
          return { produtoId: produto.id, status: data.suggestion?.status || "ok" };
        } catch {
          return { produtoId: produto.id, status: "ok" as const };
        }
      });

      const statusResults = await Promise.all(statusPromises);
      const statusMap = statusResults.reduce(
        (acc, { produtoId, status }) => {
          acc[produtoId] = status;
          return acc;
        },
        {} as { [key: string]: "ok" | "atencao" | "critico" }
      );

      setReplenishmentStatus(statusMap);
      setLastReplenishmentFetch(Date.now());
    } catch (error) {
      console.error("Erro ao buscar status de reposição:", error);
    } finally {
      setIsLoadingReplenishment(false);
    }
  };

  // DESABILITADO: Fetch automático de status de reposição
  // Isso faz 40+ chamadas API e deixa a página muito lenta
  // O status será carregado apenas quando o usuário abrir o modal
  // useEffect(() => {
  //   let isMounted = true;
  //   if (produtos.length > 0 && lastReplenishmentFetch === 0) {
  //     if (isMounted) {
  //       fetchReplenishmentStatus();
  //     }
  //   }
  //   return () => { isMounted = false; };
  // }, []);

  // Expõe a função de refresh via callback - APENAS configuração, não execução
  useEffect(() => {
    // Armazena a referência da função no window para ser chamada externamente
    (window as any).__refreshReplenishment = () => fetchReplenishmentStatus(true);

    return () => {
      delete (window as any).__refreshReplenishment;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only set once

  // Memoized callbacks to prevent re-renders
  const fetchStockDetails = useCallback(async (produto: Produto) => {
    try {
      setSelectedProduto(produto);
      setIsLoadingStock(true);
      setShowStockModal(true);

      const response = await fetch(`/api/estoque/produto/${produto.id}`);
      if (!response.ok) throw new Error("Erro ao buscar detalhes do estoque");

      const stockItems: StockItem[] = await response.json();
      setStockDetails(stockItems);
    } catch (error) {
      console.error("Erro ao buscar detalhes do estoque:", error);
    } finally {
      setIsLoadingStock(false);
    }
  }, []);

  const handleViewDetails = useCallback((produto: Produto) => {
    setSelectedProduto(produto);
    setShowDetailsModal(true);
  }, []);

  const handleEdit = useCallback((produto: Produto) => {
    setSelectedProduto(produto);
    setShowEditModal(true);
  }, []);

  const handleViewSuppliers = useCallback((produto: Produto) => {
    setSelectedProduto(produto);
    setShowFornecedorModal(true);
  }, []);

  const handleViewReplenishment = useCallback((produto: Produto) => {
    setSelectedProduto(produto);
    setShowReposicaoModal(true);
  }, []);

  const filteredProdutos = produtos.filter((produto) => {
    const matchesSearch =
      produto.nome
        .toLowerCase()
        .includes(filterOptions.searchTerm.toLowerCase()) ||
      produto.sku
        .toLowerCase()
        .includes(filterOptions.searchTerm.toLowerCase()) ||
      (produto.codigoEAN &&
        produto.codigoEAN
          .toLowerCase()
          .includes(filterOptions.searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterOptions.stockFilter !== "all") {
      const estoque = stockData[produto.id] || 0;
      const estoqueMinimo = estoqueSegurancaData[produto.id] || 0;

      switch (filterOptions.stockFilter) {
        case "low":
          return estoque <= estoqueMinimo && estoque > 0;
        case "none":
          return estoque === 0;
        case "available":
          return estoque > 0;
        default:
          return true;
      }
    }

    return true;
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredProdutos.slice(
    indexOfFirstItem,
    indexOfLastItem
  );
  const totalPages = Math.ceil(filteredProdutos.length / itemsPerPage);

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  return (
    <div>
      <Card className="border-gray-200 dark:border-gray-700 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
                <TableRow>
                  <TableHead className="font-medium">Nome</TableHead>
                  <TableHead className="font-medium">SKU</TableHead>
                  <TableHead className="font-medium">Estoque Local</TableHead>
                  <TableHead className="font-medium">Full</TableHead>
                  <TableHead className="font-medium">Vendas ML</TableHead>
                  <TableHead className="font-medium">Custo Médio</TableHead>
                  <TableHead className="font-medium text-right">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentItems.length > 0 ? (
                  currentItems.map((produto) => (
                    <ProdutoTableRow
                      key={produto.id}
                      produto={produto}
                      stockQuantity={stockData[produto.id]}
                      stockMinimum={estoqueSegurancaData[produto.id]}
                      isLoadingStock={stockData[produto.id] === undefined}
                      replenishmentStatus={replenishmentStatus[produto.id]}
                      onDelete={onDelete}
                      onViewDetails={handleViewDetails}
                      onEdit={handleEdit}
                      onViewSuppliers={handleViewSuppliers}
                      onViewStock={fetchStockDetails}
                      onViewReplenishment={handleViewReplenishment}
                    />
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-gray-500 dark:text-gray-400"
                    >
                      {filterOptions.searchTerm
                        ? "Nenhum produto encontrado com os critérios de busca."
                        : "Nenhum produto cadastrado. Adicione seu primeiro produto usando o botão 'Novo Produto'."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Paginação */}
      {filteredProdutos.length > itemsPerPage && (
        <ProdutoPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          totalItems={filteredProdutos.length}
          currentFirstItem={indexOfFirstItem + 1}
          currentLastItem={Math.min(indexOfLastItem, filteredProdutos.length)}
        />
      )}

      {/* Modais */}
      {selectedProduto && (
        <>
          <ProdutoDetalhesDialog
            isOpen={showDetailsModal}
            onClose={() => setShowDetailsModal(false)}
            produto={selectedProduto}
          />

          <ProdutoEditarDialog
            isOpen={showEditModal}
            onClose={() => setShowEditModal(false)}
            produto={selectedProduto}
            onSave={onEdit}
          />

          <ProdutoFornecedorDialog
            isOpen={showFornecedorModal}
            onClose={() => setShowFornecedorModal(false)}
            produto={selectedProduto}
          />

          <ProdutoEstoqueDialog
            isOpen={showStockModal}
            onClose={() => setShowStockModal(false)}
            produto={selectedProduto}
            stockDetails={stockDetails}
            isLoading={isLoadingStock}
          />

          {selectedProduto && (
            <ReposicaoModal
              isOpen={showReposicaoModal}
              onClose={() => setShowReposicaoModal(false)}
              produto={selectedProduto}
            />
          )}
        </>
      )}
    </div>
  );
};

export default ProdutoList;
