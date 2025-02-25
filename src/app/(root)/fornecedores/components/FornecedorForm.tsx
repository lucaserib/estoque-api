"use client";

import { useState } from "react";
import { Fornecedor } from "../types";

interface FornecedorFormProps {
  onAddFornecedor: (fornecedor: Fornecedor) => void;
}

const FornecedorForm = ({ onAddFornecedor }: FornecedorFormProps) => {
  const [nome, setNome] = useState("");
  const [inscricaoEstadual, setInscricaoEstadual] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [contato, setContato] = useState("");
  const [endereco, setEndereco] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const fornecedor = { nome, inscricaoEstadual, cnpj, contato, endereco };

    try {
      const response = await fetch("/api/fornecedores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fornecedor),
      });
      if (response.ok) {
        const newFornecedor = await response.json();
        setMessage("Fornecedor cadastrado com sucesso!");
        setMessageType("success");
        onAddFornecedor(newFornecedor);
        setNome("");
        setInscricaoEstadual("");
        setCnpj("");
        setContato("");
        setEndereco("");
      } else {
        setMessage("Erro ao cadastrar fornecedor.");
        setMessageType("error");
      }
    } catch (error) {
      console.error("Erro ao cadastrar fornecedor:", error);
      setMessage("Erro ao cadastrar fornecedor.");
      setMessageType("error");
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">
        Cadastrar Fornecedor
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Nome
          </label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Inscrição Estadual
          </label>
          <input
            type="text"
            value={inscricaoEstadual}
            onChange={(e) => setInscricaoEstadual(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            CNPJ
          </label>
          <input
            type="text"
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Contato
          </label>
          <input
            type="text"
            value={contato}
            onChange={(e) => setContato(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Endereço
          </label>
          <input
            type="text"
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Cadastrar Fornecedor
        </button>
      </form>
      {message && (
        <p
          className={`mt-4 text-center ${
            messageType === "success" ? "text-green-600" : "text-red-600"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
};
export default FornecedorForm;
