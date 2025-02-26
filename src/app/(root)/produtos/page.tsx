// app/produtos/page.tsx
"use client";
import { useState, useEffect } from "react";
import { useFetch } from "@/app/hooks/useFetch";
import ProdutoList from "./components/ProdutoList";
import KitList from "./components/KitList";
import ProdutoFormModal from "./components/ProdutoFormModal";
import { Produto } from "./types";

const ProdutosPage = () => {
  const [activeTab, setActiveTab] = useState<"produtos" | "kits">("produtos");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const {
    data: initialProdutos,
    loading,
    error,
  } = useFetch<Produto>("/api/produtos");
  const [produtos, setProdutos] = useState<Produto[]>([]);

  useEffect(() => {
    setProdutos(
      initialProdutos.map((p) => ({ ...p, ean: p.ean?.toString() || "" }))
    );
  }, [initialProdutos]);

  const kits = produtos.filter((p) => p.isKit);

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`/api/produtos?id=${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setProdutos((prev) => prev.filter((p) => p.id !== id));
      }
    } catch (error) {
      console.error("Erro ao deletar produto:", error);
    }
  };

  const handleEdit = (updatedProduto: Produto) => {
    setProdutos((prev) =>
      prev.map((p) => (p.id === updatedProduto.id ? updatedProduto : p))
    );
  };

  const handleSave = (newProduto: Produto) => {
    setProdutos((prev) => [
      ...prev,
      { ...newProduto, ean: newProduto.ean?.toString() || "" },
    ]);
  };

  if (loading)
    return (
      <p className="text-center mt-10 text-gray-500 dark:text-gray-400">
        Carregando...
      </p>
    );
  if (error) return <p className="text-center mt-10 text-red-500">{error}</p>;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Gestão de Produtos
        </h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Novo Produto/Kit
        </button>
      </div>

      <div className="flex space-x-4 mb-6 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab("produtos")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "produtos"
              ? "text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          Produtos
        </button>
        <button
          onClick={() => setActiveTab("kits")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "kits"
              ? "text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          Kits
        </button>
      </div>

      <div className="transition-all duration-300">
        {activeTab === "produtos" && (
          <ProdutoList
            produtos={produtos}
            onDelete={handleDelete}
            onEdit={handleEdit}
          />
        )}
        {activeTab === "kits" && <KitList />}
      </div>

      {showCreateModal && (
        <ProdutoFormModal
          onClose={() => setShowCreateModal(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
};

export default ProdutosPage;
