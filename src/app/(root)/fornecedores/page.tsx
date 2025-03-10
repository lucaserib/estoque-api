// app/fornecedores/page.tsx
"use client";
import { useState, useEffect } from "react";

import { useLayout } from "@/app/context/LayoutContext";
import { useFetch } from "@/app/hooks/useFetch";
import FornecedorForm from "./components/FornecedorForm";
import FornecedorList from "./components/FornecedorList";
import { Fornecedor } from "./types";

const FornecedoresPage = () => {
  const { isSidebarCollapsed } = useLayout();
  const [activeTab, setActiveTab] = useState<"list" | "create">("list");
  const {
    data: initialFornecedores,
    loading,
    error,
  } = useFetch<Fornecedor>("/api/fornecedores");
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);

  useEffect(() => {
    setFornecedores(initialFornecedores);
  }, [initialFornecedores]);

  const handleAddFornecedor = (newFornecedor: Fornecedor) => {
    setFornecedores((prev) => [...prev, newFornecedor]);
    setActiveTab("list"); // Switch to list tab after adding
  };

  const handleDeleteFornecedor = async (id: number) => {
    try {
      const response = await fetch(`/api/fornecedores?id=${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setFornecedores((prev) => prev.filter((f) => f.id !== id));
      }
    } catch (error) {
      console.error("Erro ao deletar fornecedor:", error);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      <div
        className={`flex-1 transition-all duration-300 ${
          isSidebarCollapsed ? "md:ml-16" : "md:ml-64"
        }`}
      >
        <main className="max-w-5xl mx-auto p-6">
          <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100">
            Gestão de Fornecedores
          </h1>

          {/* Tabs */}
          <div className="flex space-x-4 mb-6 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab("list")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === "list"
                  ? "text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              Lista de Fornecedores
            </button>
            <button
              onClick={() => setActiveTab("create")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === "create"
                  ? "text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              Cadastrar Fornecedor
            </button>
          </div>

          {/* Content */}
          {loading ? (
            <p className="text-gray-500 dark:text-gray-400">Carregando...</p>
          ) : error ? (
            <p className="text-red-500">{error}</p>
          ) : (
            <div className="transition-all duration-300">
              {activeTab === "list" && (
                <FornecedorList
                  fornecedores={fornecedores}
                  onDeleteFornecedor={handleDeleteFornecedor}
                />
              )}
              {activeTab === "create" && (
                <FornecedorForm onAddFornecedor={handleAddFornecedor} />
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default FornecedoresPage;
