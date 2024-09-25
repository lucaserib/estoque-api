import { useEffect, useState } from "react";
import { FaTrash } from "react-icons/fa";

interface Produto {
  id: number;
  nome: string;
  sku: string;
}

const ListarProdutos = () => {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProdutos = async () => {
      try {
        const response = await fetch("/api/produtos");
        const data = await response.json();
        setProdutos(data);
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

  if (loading) {
    return <p className="text-center mt-10">Carregando...</p>;
  }

  if (error) {
    return <p className="text-center mt-10 text-red-500">{error}</p>;
  }

  return (
    <div className="max-w-4xl mx-auto mt-10 p-6 bg-white dark:bg-gray-900 rounded-md shadow-md">
      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
        Produtos
      </h1>
      <ul className="space-y-4">
        {produtos.map((produto) => (
          <li
            key={produto.id}
            className="flex justify-between items-center p-4 bg-gray-100 dark:bg-gray-700 rounded-md shadow-sm"
          >
            <div>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {produto.nome}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                SKU: {produto.sku}
              </p>
            </div>
            <button
              onClick={() => handleDelete(produto.id)}
              className="text-red-500 hover:text-red-700"
            >
              <FaTrash />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ListarProdutos;
