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
    <div className="p-6 bg-card rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-foreground">
        Lista de Fornecedores
      </h2>
      {fornecedores.length === 0 ? (
        <p className="text-muted-foreground">
          Nenhum fornecedor encontrado.
        </p>
      ) : (
        <ul className="space-y-4">
          {fornecedores.map((fornecedor) => (
            <li
              key={fornecedor.id}
              className="flex justify-between items-center p-4 bg-muted rounded-md hover:bg-muted transition-colors"
            >
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {fornecedor.nome}
                </h3>
                <p className="text-foreground">
                  CNPJ: {fornecedor.cnpj || "Não informado"}
                </p>
                <p className="text-foreground">
                  Inscrição Estadual:{" "}
                  {fornecedor.inscricaoEstadual || "Não informado"}
                </p>
                <p className="text-foreground">
                  Contato: {fornecedor.contato || "Não informado"}
                </p>
                <p className="text-foreground">
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
