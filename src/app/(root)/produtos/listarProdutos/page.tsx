"use client";
import { useEffect, useState } from "react";
import { FaTrash, FaEdit, FaEye, FaLink } from "react-icons/fa";
import FornecedorModal from "../../../components/FornecedorModal"; // Modal para vincular fornecedor
import EditarProdutoModal from "../../../components/EditarProdutoModal"; // Novo modal para editar produto

interface Produto {
  id: number;
  nome: string;
  sku: string;
  ean: string;
  custoMedio?: number;
}

const ListarProdutos = () => {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedProduto, setSelectedProduto] = useState<Produto | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFornecedorModal, setShowFornecedorModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10); // Itens por página

  useEffect(() => {
    const fetchProdutos = async () => {
      try {
        const response = await fetch("/api/produtos");
        const data: Produto[] = await response.json();
        if (Array.isArray(data)) {
          const produtosComEan = data.map((produto) => ({
            ...produto,
            ean: produto.ean ? produto.ean.toString() : "",
          }));
          setProdutos(produtosComEan);
        } else {
          setError("Dados inválidos recebidos da API");
        }
      } catch (error) {
        setError("Erro ao buscar produtos");
      } finally {
        setLoading(false);
      }
    };

    fetchProdutos();
  }, []);

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`/api/produtos?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setProdutos(produtos.filter((produto) => produto.id !== id));
      } else {
        setError("Erro ao deletar produto");
      }
    } catch (error) {
      setError("Erro ao deletar produto");
    }
  };

  const handleViewDetails = (produto: Produto) => {
    setSelectedProduto(produto);
    setShowDetailsModal(true);
  };

  const handleEditProduto = (produto: Produto) => {
    setSelectedProduto(produto);
    setShowEditModal(true);
  };

  const handleVincularFornecedor = (produto: Produto) => {
    setSelectedProduto(produto);
    setShowFornecedorModal(true);
  };

  // Filtra os produtos com base no termo de pesquisa
  const filteredProdutos = produtos.filter(
    (produto) =>
      produto.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      produto.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Lógica de paginação
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredProdutos.slice(
    indexOfFirstItem,
    indexOfLastItem
  );

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  if (loading) {
    return <p className="text-center mt-10">Carregando...</p>;
  }

  if (error) {
    return <p className="text-center mt-10 text-red-500">{error}</p>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">
        Lista de Produtos
      </h1>

      {/* Campo de Pesquisa */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Pesquisar por nome ou SKU"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Tabela de Produtos */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Nome
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                SKU
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                EAN
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Custo Médio
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {currentItems.map((produto) => (
              <tr key={produto.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">{produto.nome}</td>
                <td className="px-6 py-4">{produto.sku}</td>
                <td className="px-6 py-4">{produto.ean}</td>
                <td className="px-6 py-4">{produto.custoMedio}</td>
                <td className="px-6 py-4 flex space-x-4">
                  <button
                    onClick={() => handleViewDetails(produto)}
                    className="text-blue-500 hover:text-blue-700"
                  >
                    <FaEye className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleEditProduto(produto)}
                    className="text-green-500 hover:text-green-700"
                  >
                    <FaEdit className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleVincularFornecedor(produto)}
                    className="text-purple-500 hover:text-purple-700"
                  >
                    <FaLink className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(produto.id)}
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

      {/* Paginação */}
      <div className="flex justify-center mt-6">
        {Array.from(
          { length: Math.ceil(filteredProdutos.length / itemsPerPage) },
          (_, i) => (
            <button
              key={i + 1}
              onClick={() => paginate(i + 1)}
              className={`px-4 py-2 mx-1 ${
                currentPage === i + 1
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700"
              } rounded-md hover:bg-blue-600 hover:text-white`}
            >
              {i + 1}
            </button>
          )
        )}
      </div>

      {/* Modal de Detalhes do Produto */}
      {showDetailsModal && selectedProduto && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-11/12 max-w-md">
            <h2 className="text-xl font-bold mb-4">Detalhes do Produto</h2>
            <p>
              <strong>Nome:</strong> {selectedProduto.nome}
            </p>
            <p>
              <strong>SKU:</strong> {selectedProduto.sku}
            </p>
            <p>
              <strong>EAN:</strong> {selectedProduto.ean}
            </p>
            <p>
              <strong>Custo Médio:</strong> {selectedProduto.custoMedio}
            </p>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
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
            setProdutos(
              produtos.map((p) =>
                p.id === updatedProduto.id ? updatedProduto : p
              )
            );
            setShowEditModal(false);
          }}
        />
      )}

      {/* Modal de Fornecedor */}
      {showFornecedorModal && selectedProduto && (
        <FornecedorModal
          produto={selectedProduto}
          onClose={() => setShowFornecedorModal(false)}
        />
      )}
    </div>
  );
};

export default ListarProdutos;
