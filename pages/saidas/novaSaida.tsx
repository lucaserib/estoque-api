// pages/novaSaida.tsx

import { Produto, Armazem, Estoque } from "@prisma/client";
import { useState, useEffect } from "react";

const NovaSaida = () => {
  const [sku, setSku] = useState("");
  const [quantidade, setQuantidade] = useState(0);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [produtoId, setProdutoId] = useState<number | null>(null);
  const [saidaProdutos, setSaidaProdutos] = useState<
    { produtoId: number; quantidade: number; sku: string; isKit: boolean }[]
  >([]);
  const [armazens, setArmazens] = useState<Armazem[]>([]);
  const [armazemId, setArmazemId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  useEffect(() => {
    const fetchArmazens = async () => {
      try {
        const response = await fetch("/api/estoque/armazens");
        const data = await response.json();
        setArmazens(data);
      } catch (error) {
        setMessage("Erro ao buscar armazéns");
        setMessageType("error");
      }
    };

    fetchArmazens();
  }, []);

  useEffect(() => {
    const fetchProdutos = async () => {
      if (!armazemId) return;

      try {
        const response = await fetch(`/api/estoque/${armazemId}`);
        const data = await response.json();
        setProdutos(data.map((item: Estoque) => ({ id: item.produtoId })));
      } catch (error) {
        setMessage("Erro ao buscar produtos");
        setMessageType("error");
      }
    };

    fetchProdutos();
  }, [armazemId]);

  const handleAddProduto = () => {
    if (!produtoId || quantidade <= 0) {
      setMessage(
        "Por favor, selecione um produto válido e quantidade maior que zero."
      );
      setMessageType("error");
      return;
    }

    const produto = produtos.find((p) => p.id === produtoId);

    if (produto) {
      setSaidaProdutos((prev) => [
        ...prev,
        {
          produtoId,
          quantidade,
          sku: produto.sku,
          isKit: produto.isKit,
        },
      ]);
      setSku("");
      setQuantidade(0);
      setProdutoId(null);
      setMessage("");
      setMessageType("");
    }
  };

  const handleRemoveProduto = (sku: string) => {
    setSaidaProdutos(saidaProdutos.filter((p) => p.sku !== sku));
  };

  const handleRegistrarSaida = async () => {
    if (saidaProdutos.length === 0 || !armazemId) {
      setMessage("Por favor, adicione produtos e selecione um armazém.");
      setMessageType("error");
      return;
    }

    try {
      // Verificar se todos os produtos do kit estão disponíveis no estoque
      for (const { produtoId, quantidade, isKit } of saidaProdutos) {
        if (isKit) {
          const kitProdutos = await fetch(`/api/kits/${produtoId}`).then(
            (res) => res.json()
          );

          for (const kitProduto of kitProdutos) {
            const estoque = await fetch(
              `/api/estoque/${armazemId}?produtoId=${kitProduto.produtoId}`
            ).then((res) => res.json());

            if (
              !estoque ||
              estoque.quantidade < kitProduto.quantidade * quantidade
            ) {
              setMessage(
                `Estoque insuficiente para o produto ${kitProduto.produto.nome} (SKU: ${kitProduto.produto.sku})`
              );
              setMessageType("error");
              return;
            }
          }
        } else {
          const estoque = await fetch(
            `/api/estoque/${armazemId}?produtoId=${produtoId}`
          ).then((res) => res.json());

          if (!estoque || estoque.quantidade < quantidade) {
            setMessage(
              `Estoque insuficiente para o produto com ID ${produtoId}`
            );
            setMessageType("error");
            return;
          }
        }
      }

      // Atualizar o estoque e registrar a saída
      for (const { produtoId, quantidade, isKit } of saidaProdutos) {
        if (isKit) {
          const kitProdutos = await fetch(`/api/kits/${produtoId}`).then(
            (res) => res.json()
          );

          for (const kitProduto of kitProdutos) {
            await fetch(`/api/estoque/${armazemId}`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                produtoId: kitProduto.produtoId,
                quantidade: -kitProduto.quantidade * quantidade,
              }),
            });

            await fetch("/api/saida", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                produtoId: kitProduto.produtoId,
                quantidade: kitProduto.quantidade * quantidade,
                armazemId,
              }),
            });
          }
        } else {
          await fetch(`/api/estoque/${armazemId}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              produtoId,
              quantidade: -quantidade,
            }),
          });

          await fetch("/api/saida", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              produtoId,
              quantidade,
              armazemId,
            }),
          });
        }
      }

      setMessage("Saída registrada com sucesso!");
      setMessageType("success");
      setSaidaProdutos([]);
    } catch (error) {
      console.error("Erro ao registrar saída:", error);
      setMessage("Erro ao registrar saída");
      setMessageType("error");
    }
  };

  const handleSkuChange = (value: string) => {
    setSku(value);
    const produto = produtos.find((p) => p.sku === value);

    if (produto) {
      setProdutoId(produto.id);
      setMessage("");
      setMessageType("");
    } else {
      setProdutoId(null);
      setMessage("Produto não encontrado");
      setMessageType("error");
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white dark:bg-gray-900 rounded-md shadow-md">
      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
        Registrar Saída
      </h1>
      <div className="mb-4">
        <label
          htmlFor="armazem"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Selecione um Armazém
        </label>
        <select
          id="armazem"
          value={armazemId || ""}
          onChange={(e) => setArmazemId(Number(e.target.value))}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
        >
          <option value="">Selecione um armazém</option>
          {armazens.map((armazem) => (
            <option key={armazem.id} value={armazem.id}>
              {armazem.nome}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-4">
        <label
          htmlFor="sku"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          SKU do Produto
        </label>
        <input
          type="text"
          id="sku"
          value={sku}
          onChange={(e) => handleSkuChange(e.target.value)}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
        />
      </div>
      <div className="mb-4">
        <label
          htmlFor="quantidade"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Quantidade
        </label>
        <input
          type="number"
          id="quantidade"
          value={quantidade}
          onChange={(e) => setQuantidade(Number(e.target.value))}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
        />
      </div>
      <button
        onClick={handleAddProduto}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        Adicionar Produto
      </button>
      {saidaProdutos.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
            Produtos na Saída
          </h2>
          <ul className="space-y-4">
            {saidaProdutos.map((produto) => (
              <li
                key={produto.sku}
                className="flex justify-between items-center p-4 bg-gray-100 dark:bg-gray-700 rounded-md shadow-sm"
              >
                <div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    SKU: {produto.sku}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Quantidade: {produto.quantidade}
                  </p>
                </div>
                <button
                  onClick={() => handleRemoveProduto(produto.sku)}
                  className="text-red-500 hover:text-red-700"
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {message && (
        <p
          className={`mt-4 text-center ${
            messageType === "success" ? "text-green-500" : "text-red-500"
          }`}
        >
          {message}
        </p>
      )}
      <button
        onClick={handleRegistrarSaida}
        className="mt-6 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
      >
        Registrar Saída
      </button>
    </div>
  );
};

export default NovaSaida;
