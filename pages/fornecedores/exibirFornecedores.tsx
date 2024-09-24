import { useEffect, useState } from "react";
import { FaTrash } from "react-icons/fa";

interface Fornecedor {
  id: number;
  nome: string;
  cnpj: string;
  inscricaoEstadual: string;
}

const ExibirFornecedores = () => {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchFornecedores = async () => {
      try {
        const response = await fetch("/api/fornecedores");
        const data = await response.json();
        setFornecedores(data);
      } catch (error) {
        setError("Erro ao buscar fornecedores");
      } finally {
        setLoading(false);
      }
    };

    fetchFornecedores();
  }, []);

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`/api/fornecedores?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setFornecedores(
          fornecedores.filter((fornecedor) => fornecedor.id !== id)
        );
      } else {
        setError("Erro ao deletar fornecedor");
      }
    } catch (error) {
      setError("Erro ao deletar fornecedor");
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
        Fornecedores
      </h1>
      <ul className="space-y-4">
        {fornecedores.map((fornecedor) => (
          <li
            key={fornecedor.id}
            className="flex justify-between items-center p-4 bg-gray-100 dark:bg-gray-700 rounded-md shadow-sm"
          >
            <div>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {fornecedor.nome}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {fornecedor.cnpj}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {fornecedor.inscricaoEstadual}
              </p>
            </div>
            <button
              onClick={() => handleDelete(fornecedor.id)}
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

export default ExibirFornecedores;
