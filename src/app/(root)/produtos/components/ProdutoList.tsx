// app/produtos/components/ProdutoList.tsx
"use client";
import { useState } from "react";
import { FaTrash, FaEdit, FaEye, FaLink } from "react-icons/fa";
import FornecedorModal from "@/app/components/FornecedorModal";
import EditarProdutoModal from "@/app/components/EditarProdutoModal";
import { Produto } from "../types";

interface ProdutoListProps {
  produtos: Produto[];
  onDelete: (id: number) => void;
  onEdit: (produto: Produto) => void;
}

const ProdutoList = ({ produtos, onDelete, onEdit }: ProdutoListProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduto, setSelectedProduto] = useState<Produto | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFornecedorModal, setShowFornecedorModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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
      <input
        type="text"
        placeholder="Pesquisar por nome ou SKU"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full p-2 mb-6 border border-gray-300 rounded-md dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-100 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                Nome
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                SKU
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                EAN
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                Custo Médio
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {currentItems.map((produto) => (
              <tr
                key={produto.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                <td className="px-6 py-4 text-gray-900 dark:text-gray-100">
                  {produto.nome}
                </td>
                <td className="px-6 py-4 text-gray-900 dark:text-gray-100">
                  {produto.sku}
                </td>
                <td className="px-6 py-4 text-gray-900 dark:text-gray-100">
                  {produto.ean || "N/A"}
                </td>
                <td className="px-6 py-4 text-gray-900 dark:text-gray-100">
                  {produto.custoMedio
                    ? `R$ ${produto.custoMedio.toFixed(2)}`
                    : "N/A"}
                </td>
                <td className="px-6 py-4 flex space-x-4">
                  <button
                    onClick={() => {
                      setSelectedProduto(produto);
                      setShowDetailsModal(true);
                    }}
                    className="text-blue-500 hover:text-blue-700"
                  >
                    <FaEye className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      setSelectedProduto(produto);
                      setShowEditModal(true);
                    }}
                    className="text-green-500 hover:text-green-700"
                  >
                    <FaEdit className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      setSelectedProduto(produto);
                      setShowFornecedorModal(true);
                    }}
                    className="text-purple-500 hover:text-purple-700"
                  >
                    <FaLink className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => onDelete(produto.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <FaTrash className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-center mt-6">
        {Array.from(
          { length: Math.ceil(filteredProdutos.length / itemsPerPage) },
          (_, i) => (
            <button
              key={i + 1}
              onClick={() => paginate(i + 1)}
              className={`px-4 py-2 mx-1 ${
                currentPage === i + 1
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-blue-500 hover:text-white"
              } rounded-md`}
            >
              {i + 1}
            </button>
          )
        )}
      </div>

      {showDetailsModal && selectedProduto && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg w-11/12 max-w-md">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
              Detalhes do Produto
            </h2>
            <p>
              <strong>Nome:</strong> {selectedProduto.nome}
            </p>
            <p>
              <strong>SKU:</strong> {selectedProduto.sku}
            </p>
            <p>
              <strong>EAN:</strong> {selectedProduto.ean || "N/A"}
            </p>
            <p>
              <strong>Custo Médio:</strong>{" "}
              {selectedProduto.custoMedio
                ? `R$ ${selectedProduto.custoMedio.toFixed(2)}`
                : "N/A"}
            </p>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

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

      {showFornecedorModal && selectedProduto && (
        <FornecedorModal
          produto={selectedProduto}
          onClose={() => setShowFornecedorModal(false)}
        />
      )}
    </div>
  );
};

export default ProdutoList;
