"use client";
import { useEffect, useState } from "react";
import { FaTrash } from "react-icons/fa";
import FornecedorModal from "../../../components/FornecedorModal"; // Importar o modal de fornecedores

interface Produto {
  id: number;
  nome: string;
  sku: string;
  ean: string;
}

const ListarProdutos = () => {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedProduto, setSelectedProduto] = useState<Produto | null>(null);
  const [searchTerm, setSearchTerm] = useState(""); // Novo estado para armazenar o termo de pesquisa

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

  const handleVincularFornecedor = (produto: Produto) => {
    setSelectedProduto(produto); // Define o produto selecionado para vincular fornecedor
  };

  // Filtrando os produtos com base no termo de pesquisa
  const filteredProdutos = produtos.filter(
    (produto) =>
      produto.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      produto.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <p className="text-center mt-10">Carregando...</p>;
  }

  if (error) {
    return <p className="text-center mt-10 text-red-500">{error}</p>;
  }

  return (
    <div className="container mx-auto px-4">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">
        Lista de Produtos
      </h1>

      {/* Campo de Pesquisa */}
      <input
        type="text"
        placeholder="Pesquisar por nome ou SKU"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)} // Atualiza o termo de pesquisa
        className="mb-4 px-4 py-2 border border-gray-300 rounded-md w-full"
      />

      <table className="min-w-full bg-white shadow-md rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-gray-100 text-gray-600 uppercase text-sm leading-normal">
            <th className="px-6 py-3">Nome</th>
            <th className="px-6 py-3">SKU</th>
            <th className="px-6 py-3">EAN</th>
            <th className="px-6 py-3">Ações</th>
          </tr>
        </thead>
        <tbody className="text-gray-700 text-sm">
          {filteredProdutos.map((produto) => (
            <tr key={produto.id} className="border-b hover:bg-gray-100">
              <td className="px-6 py-4">{produto.nome}</td>
              <td className="px-6 py-4">{produto.sku}</td>
              <td className="px-6 py-4">{produto.ean}</td>
              <td className="px-6 py-4 space-x-4 flex">
                <button
                  onClick={() => handleVincularFornecedor(produto)}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition duration-300"
                >
                  Vincular Fornecedor
                </button>
                <button
                  onClick={() => handleDelete(produto.id)}
                  className="text-red-500 hover:text-red-700 transition duration-300"
                >
                  <FaTrash />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedProduto && (
        <FornecedorModal
          produto={selectedProduto}
          onClose={() => setSelectedProduto(null)} // Fecha o modal
        />
      )}
    </div>
  );
};

export default ListarProdutos;
