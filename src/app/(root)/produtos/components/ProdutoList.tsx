"use client";
import { useState, useEffect } from "react";
import { FaTrash, FaEdit, FaEye, FaLink, FaWarehouse } from "react-icons/fa";
import { Search, Loader2, AlertTriangle } from "lucide-react";
import { Produto } from "../types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ProdutoPagination } from "./ProdutoPagination";
import { ProdutoDetalhesDialog } from "./dialogs/ProdutoDetalhesDialog";
import { ProdutoEditarDialog } from "./dialogs/ProdutoEditarDialog";
import { ProdutoFornecedorDialog } from "./dialogs/ProdutoFornecedorDialog";
import EANDisplay from "@/components/EANDisplay";

interface ProdutoListProps {
  produtos: Produto[];
  onDelete: (id: string) => void;
  onEdit: (produto: Produto) => void;
  refreshTrigger?: number;
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
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingStock, setIsLoadingStock] = useState(false);
  const [stockDetails, setStockDetails] = useState<StockItem[]>([]);
  const [stockData, setStockData] = useState<{ [key: string]: number }>({});
  const [estoqueSegurancaData, setEstoqueSegurancaData] = useState<{
    [key: string]: number;
  }>({});
  const itemsPerPage = 10;

  useEffect(() => {
    const fetchStockTotals = async () => {
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

    if (produtos.length > 0) {
      fetchStockTotals();
    }
  }, [produtos, refreshTrigger]);

  const fetchStockDetails = async (produto: Produto) => {
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
  };

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
                    <TableRow
                      key={produto.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 group"
                    >
                      <TableCell className="font-medium">
                        {produto.nome}
                      </TableCell>
                      <TableCell className="text-gray-600 dark:text-gray-300">
                        {produto.sku}
                      </TableCell>
                      <TableCell>
                        {stockData[produto.id] !== undefined ? (
                          <div className="flex items-center gap-1">
                            <Badge
                              className={
                                stockData[produto.id] === 0
                                  ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                                  : stockData[produto.id] <=
                                    (estoqueSegurancaData[produto.id] || 0)
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                                  : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                              }
                            >
                              {stockData[produto.id]}
                            </Badge>
                            {stockData[produto.id] <=
                              (estoqueSegurancaData[produto.id] || 0) &&
                              stockData[produto.id] > 0 && (
                                <AlertTriangle
                                  className="h-4 w-4 text-amber-500"
                                  data-tooltip="Estoque abaixo do nível mínimo"
                                />
                              )}
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <Loader2 className="h-4 w-4 animate-spin mr-1 text-gray-400" />
                            <span className="text-xs text-gray-400">
                              Carregando...
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {produto._mlEstoqueFull ? (
                          <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                            {produto._mlEstoqueFull}
                          </Badge>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {produto._mlTotalVendas ? (
                          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                            {produto._mlTotalVendas}
                          </Badge>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-600 dark:text-gray-300">
                        {produto.custoMedio
                          ? `R$ ${(produto.custoMedio / 100).toFixed(2)}`
                          : "Não Definido"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedProduto(produto);
                              setShowDetailsModal(true);
                            }}
                            className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                          >
                            <FaEye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedProduto(produto);
                              setShowEditModal(true);
                            }}
                            className="h-8 w-8 p-0 text-green-600 hover:text-green-800 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
                          >
                            <FaEdit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedProduto(produto);
                              setShowFornecedorModal(true);
                            }}
                            className="h-8 w-8 p-0 text-purple-600 hover:text-purple-800 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/20"
                          >
                            <FaLink className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => fetchStockDetails(produto)}
                            className="h-8 w-8 p-0 text-orange-600 hover:text-orange-800 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-900/20"
                          >
                            <FaWarehouse className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(produto.id)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                          >
                            <FaTrash className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
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
        </>
      )}
    </div>
  );
};

export default ProdutoList;
