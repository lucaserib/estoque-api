import { useEffect, useState } from "react";
import { FaTrash } from "react-icons/fa";

interface Fornecedor {
  id: number;
  nome: string;
  cnpj: string;
  inscricaoEstadual: string;
  contato: string;
  endereco: string;
}

const ExibirFornecedores = () => {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);

  useEffect(() => {
    const fetchFornecedores = async () => {
      try {
        const response = await fetch("/api/fornecedores");
        const data = await response.json();
        setFornecedores(data);
      } catch (error) {
        console.error("Erro ao buscar fornecedores:", error);
      }
    };

    fetchFornecedores();
  }, []);

  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/fornecedores?id=${id}`, {
        method: "DELETE",
      });
      setFornecedores(fornecedores.filter((f) => f.id !== id));
    } catch (error) {
      console.error("Erro ao deletar fornecedor:", error);
    }
  };

  return (
    <div className="max-w-5xl mx-auto mt-10 p-8 bg-white dark:bg-gray-900 rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100 text-center">
        Fornecedores
      </h1>
      <ul className="space-y-4">
        {fornecedores.map((fornecedor) => (
          <li
            key={fornecedor.id}
            className="flex justify-between items-center p-4 bg-gray-100 dark:bg-gray-800 rounded-md shadow-sm"
          >
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {fornecedor.nome}
              </h2>
              <p className="text-gray-700 dark:text-gray-400">
                CNPJ: {fornecedor.cnpj || "Não informado"}
              </p>
              <p className="text-gray-700 dark:text-gray-400">
                Inscrição Estadual:{" "}
                {fornecedor.inscricaoEstadual || "Não informado"}
              </p>
              <p className="text-gray-700 dark:text-gray-400">
                Contato: {fornecedor.contato || "Não informado"}
              </p>
              <p className="text-gray-700 dark:text-gray-400">
                Endereço: {fornecedor.endereco || "Não informado"}
              </p>
            </div>
            <button
              onClick={() => handleDelete(fornecedor.id)}
              className="text-red-600 hover:text-red-800 dark:text-red-500 dark:hover:text-red-700"
            >
              <FaTrash size={20} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ExibirFornecedores;
