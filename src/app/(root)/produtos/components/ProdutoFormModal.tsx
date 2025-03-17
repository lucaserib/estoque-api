// app/produtos/components/ProdutoFormModal.tsx
"use client";
import { useState, useEffect } from "react";
import { useFetch } from "@/app/hooks/useFetch";
import { Produto, KitComponente } from "../types";
import { FaPlus, FaTimes } from "react-icons/fa";

interface ProdutoFormModalProps {
  onClose: () => void;
  onSave: (produto: Produto) => void;
}

const ProdutoFormModal = ({ onClose, onSave }: ProdutoFormModalProps) => {
  const [nome, setNome] = useState("");
  const [sku, setSku] = useState("");
  const [ean, setEan] = useState("");
  const [isKit, setIsKit] = useState(false);
  const [kitProdutos, setKitProdutos] = useState<KitComponente[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [quantidades, setQuantidades] = useState<{ [key: string]: number }>({});
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: produtos, loading } = useFetch<Produto>("/api/produtos");

  if (!produtos) return null;

  const filteredProdutos = produtos.filter(
    (produto) =>
      produto.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      produto.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const produtoOuKit = isKit
      ? { nome, sku, ean: ean || null, componentes: kitProdutos, isKit: true }
      : { nome, sku, ean: ean || null, isKit: false };

    const endpoint = isKit ? "/api/kits" : "/api/produtos";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(produtoOuKit),
      });

      if (response.ok) {
        const newProduto = await response.json();
        setMessage("Produto ou kit cadastrado com sucesso!");
        setMessageType("success");
        onSave(newProduto);
        setNome("");
        setSku("");
        setEan("");
        setIsKit(false);
        setKitProdutos([]);
        setTimeout(onClose, 1500);
      } else {
        const errorData = await response.json();
        setMessage(errorData.error || "Erro ao cadastrar.");
        setMessageType("error");
      }
    } catch (error) {
      console.error("Erro ao cadastrar:", error);
      setMessage("Erro ao cadastrar.");
      setMessageType("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddProdutoAoKit = (produtoId: string) => {
    const quantidade = quantidades[produtoId] || 0;
    if (quantidade > 0) {
      // Verificar se o produto já existe no kit
      if (!kitProdutos.some((item) => item.produtoId === produtoId)) {
        setKitProdutos((prev) => [...prev, { produtoId, quantidade }]);
        setQuantidades((prev) => ({ ...prev, [produtoId]: 0 }));
      } else {
        // Atualizar a quantidade se o produto já existir
        setKitProdutos((prev) =>
          prev.map((item) =>
            item.produtoId === produtoId
              ? { ...item, quantidade: item.quantidade + quantidade }
              : item
          )
        );
        setQuantidades((prev) => ({ ...prev, [produtoId]: 0 }));
      }
    }
  };

  const handleRemoveProdutoDoKit = (produtoId: string) => {
    setKitProdutos((prev) => prev.filter((p) => p.produtoId !== produtoId));
  };

  const handleQuantidadeChange = (produtoId: string, quantidade: number) => {
    setQuantidades((prev) => ({ ...prev, [produtoId]: quantidade }));
  };

  return (
    <div className="fixed inset-0 z-50 overflow-auto flex">
      {/* Backdrop com blur */}
      <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm"></div>

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg mx-auto my-8 p-6 w-full animate-fade-in transition-all">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {isKit ? "Cadastrar Kit" : "Cadastrar Produto"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            <FaTimes className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nome
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600"
              placeholder="Nome do produto"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              SKU
            </label>
            <input
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              required
              className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600"
              placeholder="SKU único"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              EAN (opcional)
            </label>
            <input
              type="text"
              value={ean}
              onChange={(e) => setEan(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600"
              placeholder="Código de barras EAN"
            />
          </div>

          <div className="flex items-center space-x-2 py-2">
            <input
              id="isKitCheckbox"
              type="checkbox"
              checked={isKit}
              onChange={(e) => setIsKit(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label
              htmlFor="isKitCheckbox"
              className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none"
            >
              Este produto é um Kit?
            </label>
          </div>

          {isKit && (
            <div className="space-y-4 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">
                Componentes do Kit
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Buscar Produtos
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nome ou SKU"
                  className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600"
                />
              </div>

              {loading ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                </div>
              ) : filteredProdutos.length > 0 ? (
                <div className="max-h-40 overflow-y-auto shadow-inner rounded-md bg-white dark:bg-gray-800">
                  <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredProdutos.map((produto) => (
                      <li
                        key={produto.id}
                        className="flex items-center justify-between p-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <span className="text-sm text-gray-900 dark:text-gray-200 truncate">
                          {produto.nome}
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                            (SKU: {produto.sku})
                          </span>
                        </span>
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            min="1"
                            value={quantidades[produto.id] || ""}
                            onChange={(e) =>
                              handleQuantidadeChange(
                                produto.id,
                                parseInt(e.target.value) || 0
                              )
                            }
                            className="w-16 p-1 border border-gray-300 rounded-md dark:bg-gray-600 dark:text-gray-200 text-center"
                            placeholder="Qtd"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddProdutoAoKit(produto.id)}
                            disabled={
                              !quantidades[produto.id] ||
                              quantidades[produto.id] <= 0
                            }
                            className="p-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
                            title="Adicionar ao kit"
                          >
                            <FaPlus className="w-4 h-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : searchTerm ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                  Nenhum produto encontrado com este termo.
                </p>
              ) : null}

              {kitProdutos.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Produtos adicionados ao kit:
                  </h4>
                  <ul className="space-y-2 bg-white dark:bg-gray-800 p-2 rounded-md shadow-sm">
                    {kitProdutos.map((kitProduto) => {
                      const produto = produtos.find(
                        (p) => p.id === kitProduto.produtoId
                      );
                      return (
                        <li
                          key={kitProduto.produtoId}
                          className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                        >
                          <div className="flex-1">
                            <span className="text-sm text-gray-900 dark:text-gray-200">
                              {produto?.nome || "Produto não encontrado"}
                            </span>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              SKU: {produto?.sku || "N/A"}
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <span className="text-blue-600 dark:text-blue-400 font-medium text-sm">
                              Qtd: {kitProduto.quantidade}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveProdutoDoKit(kitProduto.produtoId)
                              }
                              className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                              title="Remover do kit"
                            >
                              <FaTimes className="w-4 h-4" />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}

          {message && (
            <div
              className={`p-3 rounded-md ${
                messageType === "success"
                  ? "bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-200"
                  : "bg-red-100 text-red-700 dark:bg-red-800 dark:text-red-200"
              }`}
            >
              {message}
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center justify-center min-w-[100px]"
            >
              {isSubmitting ? (
                <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
              ) : (
                "Cadastrar"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProdutoFormModal;
