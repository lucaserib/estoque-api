// app/fornecedores/components/FornecedorList.tsx
"use client";
import { FaTrash } from "react-icons/fa";
import { Fornecedor } from "../types";

interface FornecedorListProps {
  fornecedores: Fornecedor[];
  onDeleteFornecedor: (id: number) => void;
}

const FornecedorList = ({
  fornecedores,
  onDeleteFornecedor,
}: FornecedorListProps) => {
  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">
        Lista de Fornecedores
      </h2>
      {fornecedores.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">
          Nenhum fornecedor encontrado.
        </p>
      ) : (
        <ul className="space-y-4">
          {fornecedores.map((fornecedor) => (
            <li
              key={fornecedor.id}
              className="flex justify-between items-center p-4 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {fornecedor.nome}
                </h3>
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
                onClick={() => onDeleteFornecedor(fornecedor.id)}
                className="text-red-600 hover:text-red-800 dark:text-red-500 dark:hover:text-red-700 transition-colors"
              >
                <FaTrash size={20} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default FornecedorList;
