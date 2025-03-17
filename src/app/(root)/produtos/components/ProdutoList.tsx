"use client";
import { useState, useEffect } from "react";
import { FaTrash, FaEdit, FaEye, FaLink, FaWarehouse } from "react-icons/fa";
import { Search, Loader2 } from "lucide-react";
import { Produto } from "../types";
import { useFetch } from "@/app/hooks/useFetch";
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
import { ProdutoDetalhesDialog } from "./dialogs/ProdutoDetalhesDialog";
import { ProdutoEditarDialog } from "./dialogs/ProdutoEditarDialog";
import { ProdutoFornecedorDialog } from "./dialogs/ProdutoFornecedorDialog";
import { ProdutoEstoqueDialog } from "./dialogs/ProdutoEstoqueDialog";
import { ProdutoPagination } from "./ProdutoPagination";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduto, setSelectedProduto] = useState<Produto | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFornecedorModal, setShowFornecedorModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingStock, setIsLoadingStock] = useState(false);
  const [stockDetails, setStockDetails] = useState<StockItem[]>([]);
  const [stockData, setStockData] = useState<{ [key: string]: number }>({});
  const itemsPerPage = 10;

  // Fetch stock data when component mounts or refreshTrigger changes
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
          return { produtoId: produto.id, totalQuantity };
        });

        const stockResults = await Promise.all(stockPromises);
        const stockMap = stockResults.reduce(
          (acc, { produtoId, totalQuantity }) => {
            acc[produtoId] = totalQuantity;
            return acc;
          },
          {} as { [key: string]: number }
        );

        setStockData(stockMap);
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

  const filteredProdutos = produtos.filter(
    (produto) =>
      produto.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      produto.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  const handleDeleteClick = async (id: string) => {
    if (window.confirm("Tem certeza que deseja excluir este produto?")) {
      onDelete(id);
    }
  };

  return (
    <div>
      <div className="mb-6 relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <Search className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        </div>
        <Input
          type="text"
          placeholder="Buscar por nome ou SKU..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 w-full border-gray-300 dark:border-gray-600"
        />
      </div>

      <Card className="border-gray-200 dark:border-gray-700 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
                <TableRow>
                  <TableHead className="font-medium">Nome</TableHead>
                  <TableHead className="font-medium">SKU</TableHead>
                  <TableHead className="font-medium">EAN</TableHead>
                  <TableHead className="font-medium">Custo Médio</TableHead>
                  <TableHead className="font-medium">Estoque</TableHead>
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
                      <TableCell className="text-gray-600 dark:text-gray-300">
                        {produto.ean || "N/A"}
                      </TableCell>
                      <TableCell className="text-gray-600 dark:text-gray-300">
                        {produto.custoMedio
                          ? `R$ ${(produto.custoMedio / 100).toFixed(2)}`
                          : "N/A"}
                      </TableCell>
                      <TableCell>
                        {stockData[produto.id] !== undefined ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
                            {stockData[produto.id]}
                          </span>
                        ) : (
                          <div className="flex items-center">
                            <Loader2 className="h-4 w-4 animate-spin mr-1 text-gray-400" />
                            <span className="text-xs text-gray-400">
                              Carregando...
                            </span>
                          </div>
                        )}
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
                            onClick={() => handleDeleteClick(produto.id)}
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
                      colSpan={6}
                      className="text-center py-8 text-gray-500 dark:text-gray-400"
                    >
                      {searchTerm
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
