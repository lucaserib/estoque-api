import { useEffect, useState } from "react";
import { FaTrash } from "react-icons/fa";
import FornecedorModal from "../../components/FornecedorModal"; // Importar o modal de fornecedores

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

  useEffect(() => {
    const fetchProdutos = async () => {
      try {
        const response = await fetch("/api/produtos");
        const data = await response.json();
        if (Array.isArray(data)) {
          const produtosComEan = data.map((produto: any) => ({
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

  if (loading) {
    return <p className="text-center mt-10">Carregando...</p>;
  }

  if (error) {
    return <p className="text-center mt-10 text-red-500">{error}</p>;
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Lista de Produtos</h1>
      <table className="min-w-full table-auto">
        <thead>
          <tr>
            <th className="px-4 py-2">Nome</th>
            <th className="px-4 py-2">SKU</th>
            <th className="px-4 py-2">EAN</th>
            <th className="px-4 py-2">Ações</th>
          </tr>
        </thead>
        <tbody>
          {produtos.map((produto) => (
            <tr key={produto.id} className="border-t">
              <td className="px-4 py-2">{produto.nome}</td>
              <td className="px-4 py-2">{produto.sku}</td>
              <td className="px-4 py-2">{produto.ean}</td>
              <td className="px-4 py-2 space-x-4">
                <button
                  onClick={() => handleVincularFornecedor(produto)}
                  className="bg-blue-500 text-white px-2 py-1 rounded"
                >
                  Vincular Fornecedor
                </button>
                <button
                  onClick={() => handleDelete(produto.id)}
                  className="text-red-500"
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
