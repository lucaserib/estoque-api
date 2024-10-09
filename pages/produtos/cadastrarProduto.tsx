// pages/cadastrarProduto.tsx
import React, { useEffect, useState } from "react";

interface Produto {
  id: number;
  nome: string;
  sku: string;
}

const CadastrarProdutoOuKit = () => {
  const [nome, setNome] = useState("");
  const [sku, setSku] = useState("");
  const [isKit, setIsKit] = useState(false); // Para definir se é um produto ou kit
  const [produtos, setProdutos] = useState<Produto[]>([]); // Lista de produtos disponíveis
  const [kitProdutos, setKitProdutos] = useState<
    { produtoId: number; quantidade: number }[]
  >([]); // Produtos no kit
  const [searchTerm, setSearchTerm] = useState(""); // Termo de pesquisa para os SKUs
  const [filteredProdutos, setFilteredProdutos] = useState<Produto[]>([]); // Produtos filtrados pela pesquisa
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  useEffect(() => {
    // Buscar produtos disponíveis no sistema para serem usados em kits
    const fetchProdutos = async () => {
      try {
        const response = await fetch("/api/produtos");
        const data = await response.json();
        setProdutos(data);
      } catch (error) {
        console.error("Erro ao buscar produtos:", error);
      }
    };

    fetchProdutos();
  }, []);

  useEffect(() => {
    // Filtrar produtos de acordo com o termo de pesquisa (nome ou SKU)
    const filtered = produtos.filter(
      (produto) =>
        produto.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        produto.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredProdutos(filtered);
  }, [searchTerm, produtos]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const produtoOuKit = isKit
      ? { nome, sku, produtos: kitProdutos } // Se for kit, inclui produtos e quantidades
      : { nome, sku };

    try {
      const response = await fetch("/api/produtos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(produtoOuKit),
      });

      if (response.ok) {
        setMessage(
          isKit
            ? "Kit cadastrado com sucesso!"
            : "Produto cadastrado com sucesso!"
        );
        setMessageType("success");
        setNome("");
        setSku("");
        setKitProdutos([]);
        setSearchTerm("");
      } else {
        setMessage("Erro ao cadastrar.");
        setMessageType("error");
      }
    } catch (error) {
      console.error("Erro ao cadastrar:", error);
      setMessage("Erro ao cadastrar.");
      setMessageType("error");
    }
  };

  const handleAddProdutoAoKit = (produtoId: number, quantidade: number) => {
    setKitProdutos((prevKitProdutos) => {
      const existingProduto = prevKitProdutos.find(
        (p) => p.produtoId === produtoId
      );
      if (existingProduto) {
        return prevKitProdutos.map((p) =>
          p.produtoId === produtoId
            ? { ...p, quantidade: p.quantidade + quantidade }
            : p
        );
      } else {
        return [...prevKitProdutos, { produtoId, quantidade }];
      }
    });
  };

  const handleRemoveProdutoDoKit = (produtoId: number) => {
    setKitProdutos(kitProdutos.filter((p) => p.produtoId !== produtoId));
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white dark:bg-gray-900 rounded-md shadow-md">
      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
        {isKit ? "Cadastrar Kit" : "Cadastrar Produto"}
      </h1>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <input
            type="text"
            placeholder="Nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border rounded-md shadow-lg"
            required
          />
        </div>

        <div className="mb-4">
          <input
            type="text"
            placeholder="SKU"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border rounded-md shadow-lg"
            required
          />
        </div>

        <div className="mb-4">
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              checked={isKit}
              onChange={(e) => setIsKit(e.target.checked)}
              className="form-checkbox"
            />
            <span className="ml-2">É um kit?</span>
          </label>
        </div>

        {isKit && (
          <div className="mb-4">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border rounded-md shadow-lg"
              placeholder="Buscar produtos por nome ou SKU"
            />
            <ul className="mt-2">
              {filteredProdutos.map((produto) => (
                <li key={produto.id}>
                  <div className="flex justify-between items-center">
                    <span>
                      {produto.nome} (SKU: {produto.sku})
                    </span>
                    <button
                      type="button"
                      onClick={
                        () => handleAddProdutoAoKit(produto.id, 1) // Adiciona com quantidade 1 por padrão
                      }
                      className="ml-2 px-2 py-1 bg-blue-500 text-white rounded-md"
                    >
                      Adicionar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <ul className="mt-4">
              {kitProdutos.map((kitProduto) => {
                const produto = produtos.find(
                  (p) => p.id === kitProduto.produtoId
                );
                return (
                  <li key={kitProduto.produtoId}>
                    <div className="flex justify-between items-center">
                      <span>
                        {produto?.nome} (SKU: {produto?.sku}) - Quantidade:{" "}
                        {kitProduto.quantidade}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleRemoveProdutoDoKit(kitProduto.produtoId)
                        }
                        className="ml-2 px-2 py-1 bg-red-500 text-white rounded-md"
                      >
                        Remover
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <button
          type="submit"
          className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          {isKit ? "Cadastrar Kit" : "Cadastrar Produto"}
        </button>
      </form>

      {message && (
        <p
          className={`mt-4 text-center ${
            messageType === "success" ? "text-green-500" : "text-red-500"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
};

export default CadastrarProdutoOuKit;
