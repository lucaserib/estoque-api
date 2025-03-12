// app/produtos/components/ProdutoList.tsx
"use client";
import { useState, useEffect } from "react";
import {
  FaTrash,
  FaEdit,
  FaEye,
  FaLink,
  FaWarehouse,
  FaSpinner,
} from "react-icons/fa";
import FornecedorModal from "@/app/components/FornecedorModal";
import EditarProdutoModal from "@/app/components/EditarProdutoModal";
import { Produto } from "../types";
import { useFetch } from "@/app/hooks/useFetch";

interface ProdutoListProps {
  produtos: Produto[];
  onDelete: (id: string) => void;
  onEdit: (produto: Produto) => void;
}

interface StockItem {
  produtoId: string;
  armazemId: string;
  quantidade: number;
  estoqueSeguranca?: number;
  armazem?: { id: string; nome: string };
}

const ProdutoList = ({ produtos, onDelete, onEdit }: ProdutoListProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduto, setSelectedProduto] = useState<Produto | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFornecedorModal, setShowFornecedorModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockData, setStockData] = useState<{ [key: string]: number }>({});
  const [stockDetails, setStockDetails] = useState<StockItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingStock, setIsLoadingStock] = useState(false);
  const itemsPerPage = 10;

  const { data: armazens } = useFetch<{ id: string; nome: string }[]>(
    "/api/estoque/criarArmazem"
  );

  useEffect(() => {
    const fetchStockTotals = async () => {
      try {
        const stockPromises = produtos.map(async (produto) => {
          const response = await fetch(`/api/estoque/produto/${produto.id}`);
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
    fetchStockTotals();
  }, [produtos]);

  const fetchStockDetails = async (produto: Produto) => {
    try {
      setSelectedProduto(produto);
      setIsLoadingStock(true);
      setShowStockModal(true);

      const response = await fetch(`/api/estoque/produto/${produto.id}`);
      const stockItems: StockItem[] = await response.json();
      setStockDetails(stockItems);
      setIsLoadingStock(false);
    } catch (error) {
      console.error("Erro ao buscar detalhes do estoque:", error);
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

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  return (
    <div>
      <div className="mb-6 relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <svg
            className="w-4 h-4 text-gray-500 dark:text-gray-400"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 20 20"
          >
            <path
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"
            />
          </svg>
        </div>
        <input
          type="text"
          placeholder="Pesquisar por nome ou SKU"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-2 pl-10 border border-gray-300 rounded-lg dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600"
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                >
                  Nome
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                >
                  SKU
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                >
                  EAN
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                >
                  Custo Médio
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                >
                  Quantidade Total
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                >
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {currentItems.length > 0 ? (
                currentItems.map((produto) => (
                  <tr
                    key={produto.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {produto.nome}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {produto.sku}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {produto.ean || "N/A"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {produto.custoMedio
                          ? `R$ ${produto.custoMedio.toFixed(2)}`
                          : "N/A"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {stockData[produto.id] !== undefined ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
                            {stockData[produto.id]}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                            <FaSpinner className="animate-spin mr-1" />{" "}
                            Carregando...
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => {
                            setSelectedProduto(produto);
                            setShowDetailsModal(true);
                          }}
                          className="text-blue-500 hover:text-blue-700 transition-colors duration-150"
                          title="Ver detalhes"
                        >
                          <FaEye className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedProduto(produto);
                            setShowEditModal(true);
                          }}
                          className="text-green-500 hover:text-green-700 transition-colors duration-150"
                          title="Editar produto"
                        >
                          <FaEdit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedProduto(produto);
                            setShowFornecedorModal(true);
                          }}
                          className="text-purple-500 hover:text-purple-700 transition-colors duration-150"
                          title="Vincular fornecedor"
                        >
                          <FaLink className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => fetchStockDetails(produto)}
                          className="text-orange-500 hover:text-orange-700 transition-colors duration-150"
                          title="Ver estoque por armazém"
                        >
                          <FaWarehouse className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => onDelete(produto.id)}
                          className="text-red-500 hover:text-red-700 transition-colors duration-150"
                          title="Excluir produto"
                        >
                          <FaTrash className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500 dark:text-gray-400"
                  >
                    Nenhum produto encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginação */}
      {filteredProdutos.length > itemsPerPage && (
        <div className="flex justify-center items-center space-x-1 mt-6">
          <button
            onClick={() => paginate(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          {Array.from(
            {
              length: Math.min(
                5,
                Math.ceil(filteredProdutos.length / itemsPerPage)
              ),
            },
            (_, i) => {
              const pageNum = i + 1;
              return (
                <button
                  key={pageNum}
                  onClick={() => paginate(pageNum)}
                  className={`px-3 py-1 rounded-md ${
                    currentPage === pageNum
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {pageNum}
                </button>
              );
            }
          )}
          {Math.ceil(filteredProdutos.length / itemsPerPage) > 5 && (
            <span className="px-2 text-gray-500">...</span>
          )}
          <button
            onClick={() =>
              paginate(
                Math.min(
                  Math.ceil(filteredProdutos.length / itemsPerPage),
                  currentPage + 1
                )
              )
            }
            disabled={
              currentPage === Math.ceil(filteredProdutos.length / itemsPerPage)
            }
            className="px-3 py-1 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Próxima
          </button>
        </div>
      )}

      {/* Modal de Detalhes do Produto */}
      {showDetailsModal && selectedProduto && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg w-11/12 max-w-md animate-fade-in">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
              Detalhes do Produto
            </h2>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1 font-semibold text-gray-700 dark:text-gray-300">
                  Nome:
                </div>
                <div className="col-span-2 text-gray-900 dark:text-gray-100">
                  {selectedProduto.nome}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1 font-semibold text-gray-700 dark:text-gray-300">
                  SKU:
                </div>
                <div className="col-span-2 text-gray-900 dark:text-gray-100">
                  {selectedProduto.sku}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1 font-semibold text-gray-700 dark:text-gray-300">
                  EAN:
                </div>
                <div className="col-span-2 text-gray-900 dark:text-gray-100">
                  {selectedProduto.ean || "N/A"}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1 font-semibold text-gray-700 dark:text-gray-300">
                  Custo Médio:
                </div>
                <div className="col-span-2 text-gray-900 dark:text-gray-100">
                  {selectedProduto.custoMedio !== undefined
                    ? `R$ ${(selectedProduto.custoMedio / 100).toFixed(2)}`
                    : "N/A"}
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors duration-150"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição do Produto */}
      {showEditModal && selectedProduto && (
        <EditarProdutoModal
          produto={selectedProduto}
          onClose={() => setShowEditModal(false)}
          onSave={(updatedProduto) => {
            onEdit(updatedProduto);
            setShowEditModal(false);
          }}
        />
      )}

      {/* Modal de Fornecedores */}
      {showFornecedorModal && selectedProduto && (
        <FornecedorModal
          produto={selectedProduto}
          onClose={() => setShowFornecedorModal(false)}
        />
      )}

      {/* Modal de Estoque por Armazém */}
      {showStockModal && selectedProduto && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg w-11/12 max-w-md max-h-[80vh] overflow-y-auto animate-fade-in">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
              Estoque de {selectedProduto.nome}
            </h2>
            <div className="mb-2 text-sm text-gray-600 dark:text-gray-400">
              SKU: {selectedProduto.sku}
            </div>

            {isLoadingStock ? (
              <div className="flex justify-center items-center py-6">
                <FaSpinner className="animate-spin w-8 h-8 text-blue-500" />
                <span className="ml-3 text-gray-600 dark:text-gray-400">
                  Carregando informações de estoque...
                </span>
              </div>
            ) : stockDetails.length > 0 ? (
              <ul className="space-y-2 mt-4">
                {stockDetails.map((item) => (
                  <li
                    key={item.armazemId}
                    className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg shadow-sm text-gray-900 dark:text-gray-200 border border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-semibold">Armazém:</span>{" "}
                        {item.armazem?.nome || "Desconhecido"}
                      </div>
                      <div className="font-medium text-blue-600 dark:text-blue-400">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                          {item.quantidade} unidades
                        </span>
                      </div>
                    </div>
                    {item.estoqueSeguranca && (
                      <div className="mt-2 text-sm">
                        <span className="font-semibold">
                          Estoque de Segurança:
                        </span>{" "}
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
                          {item.estoqueSeguranca} unidades
                        </span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                Nenhum estoque encontrado para este produto.
              </p>
            )}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowStockModal(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors duration-150"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProdutoList;
