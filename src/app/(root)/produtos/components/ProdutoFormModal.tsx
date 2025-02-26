// app/produtos/components/ProdutoFormModal.tsx
"use client";
import { useState, useEffect } from "react";
import { useFetch } from "@/app/hooks/useFetch";
import { Produto, KitComponente } from "../types";

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
  const [quantidades, setQuantidades] = useState<{ [key: number]: number }>({});
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  const { data: produtos, loading } = useFetch<Produto>("/api/produtos");
  const filteredProdutos = produtos.filter(
    (produto) =>
      produto.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      produto.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
        setTimeout(onClose, 1500); // Fecha após sucesso
      } else {
        const errorData = await response.json();
        setMessage(errorData.error || "Erro ao cadastrar.");
        setMessageType("error");
      }
    } catch (error) {
      console.error("Erro ao cadastrar:", error);
      setMessage("Erro ao cadastrar.");
      setMessageType("error");
    }
  };

  const handleAddProdutoAoKit = (produtoId: number) => {
    const quantidade = quantidades[produtoId] || 0;
    if (quantidade > 0) {
      setKitProdutos((prev) => [...prev, { produtoId, quantidade }]);
      setQuantidades((prev) => ({ ...prev, [produtoId]: 0 }));
    }
  };

  const handleRemoveProdutoDoKit = (produtoId: number) => {
    setKitProdutos((prev) => prev.filter((p) => p.produtoId !== produtoId));
  };

  const handleQuantidadeChange = (produtoId: number, quantidade: number) => {
    setQuantidades((prev) => ({ ...prev, [produtoId]: quantidade }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">
          Cadastrar Produto ou Kit
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
              SKU
            </label>
            <input
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              required
              className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              EAN (opcional)
            </label>
            <input
              type="text"
              value={ean}
              onChange={(e) => setEan(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={isKit}
              onChange={(e) => setIsKit(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              É um Kit?
            </label>
          </div>
          {isKit && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Buscar Produtos
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Nome ou SKU"
                  className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {loading ? (
                <p className="text-gray-500 dark:text-gray-400">
                  Carregando produtos...
                </p>
              ) : (
                <ul className="space-y-2 max-h-40 overflow-y-auto">
                  {filteredProdutos.map((produto) => (
                    <li
                      key={produto.id}
                      className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-700 rounded-md"
                    >
                      <span>
                        {produto.nome} (SKU: {produto.sku})
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
                          className="w-16 p-1 border border-gray-300 rounded-md dark:bg-gray-600 dark:text-gray-200"
                          placeholder="Qtd"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddProdutoAoKit(produto.id)}
                          className="px-2 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                          Adicionar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <ul className="space-y-2">
                {kitProdutos.map((kitProduto) => {
                  const produto = produtos.find(
                    (p) => p.id === kitProduto.produtoId
                  );
                  return (
                    <li
                      key={kitProduto.produtoId}
                      className="flex justify-between items-center p-2 bg-gray-100 dark:bg-gray-700 rounded-md"
                    >
                      <span>
                        {produto?.nome || "Produto não encontrado"} (SKU:{" "}
                        {produto?.sku || "N/A"}) - Qtd: {kitProduto.quantidade}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleRemoveProdutoDoKit(kitProduto.produtoId)
                        }
                        className="text-red-600 hover:text-red-800 dark:text-red-500 dark:hover:text-red-700"
                      >
                        Remover
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Cadastrar
            </button>
          </div>
          {message && (
            <p
              className={`mt-4 text-center ${
                messageType === "success" ? "text-green-600" : "text-red-600"
              }`}
            >
              {message}
            </p>
          )}
        </form>
      </div>
    </div>
  );
};

export default ProdutoFormModal;
