import React, { useEffect, useState } from "react";

interface Produto {
  id: number;
  nome: string;
  sku: string;
}

interface Armazem {
  id: number;
  nome: string;
}

const NovaSaida = () => {
  const [sku, setSku] = useState("");
  const [quantidade, setQuantidade] = useState(0);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [produtoId, setProdutoId] = useState<number | null>(null);
  const [saidaProdutos, setSaidaProdutos] = useState<
    { produtoId: number; quantidade: number; sku: string }[]
  >([]);
  const [armazens, setArmazens] = useState<Armazem[]>([]);
  const [armazemId, setArmazemId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  useEffect(() => {
    const fetchArmazens = async () => {
      try {
        const response = await fetch("/api/estoque/criarArmazem");
        const data = await response.json();
        setArmazens(data);
      } catch (error) {
        console.error("Erro ao buscar armazéns:", error);
      }
    };

    fetchArmazens();
  }, []);

  useEffect(() => {
    const fetchProdutos = async () => {
      if (!armazemId) return;

      try {
        const response = await fetch(
          `/api/estoque/armazens?armazemId=${armazemId}`
        );
        const data = await response.json();
        setProdutos(data.map((item: any) => item.produto));
      } catch (error) {
        console.error("Erro ao buscar produtos:", error);
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
      const response = await fetch("/api/saida", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ produtos: saidaProdutos, armazemId }),
      });

      if (response.ok) {
        setMessage("Saída registrada com sucesso!");
        setMessageType("success");
        setSaidaProdutos([]);
        setArmazemId(null);
      } else {
        const errorData = await response.json();
        setMessage(errorData.error || "Erro ao registrar saída");
        setMessageType("error");
      }
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
    } else {
      setProdutoId(null);
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
          Selecione o Armazém
        </label>
        <select
          id="armazem"
          name="armazem"
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          onChange={(e) => setArmazemId(Number(e.target.value))}
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
          name="sku"
          value={sku}
          onChange={(e) => handleSkuChange(e.target.value)}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          list="produtos"
        />
        <datalist id="produtos">
          {produtos.map((produto) => (
            <option key={produto.id} value={produto.sku}>
              {produto.nome}
            </option>
          ))}
        </datalist>
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
          name="quantidade"
          value={quantidade}
          onChange={(e) => setQuantidade(Number(e.target.value))}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
        />
      </div>
      <button
        onClick={handleAddProduto}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        Adicionar Produto
      </button>
      {saidaProdutos.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
            Produtos para Saída
          </h2>
          <ul className="space-y-4">
            {saidaProdutos.map((produto) => (
              <li
                key={produto.sku}
                className="flex justify-between items-center p-4 bg-gray-100 dark:bg-gray-800 rounded-md shadow-md"
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
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={handleRegistrarSaida}
            className="w-full mt-6 py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            Registrar Saída
          </button>
        </div>
      )}
      {message && (
        <p
          className={`text-center mt-4 ${
            messageType === "success" ? "text-green-500" : "text-red-500"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
};

export default NovaSaida;
