import React, { useEffect, useState } from "react";

interface Produto {
  id: number;
  nome: string;
  sku: string;
  isKit: boolean;
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
        const response = await fetch(`/api/produtos?armazemId=${armazemId}`);
        const data = await response.json();
        setProdutos(data);
      } catch (error) {
        setMessage("Erro ao buscar produtos");
        setMessageType("error");
      }
    };

    fetchProdutos();
  }, [armazemId]);

  const handleAddProduto = async () => {
    if (!produtoId || quantidade <= 0) {
      setMessage(
        "Por favor, selecione um produto válido e quantidade maior que zero."
      );
      setMessageType("error");
      return;
    }

    const produto = produtos.find((p) => p.id === produtoId);

    if (produto) {
      if (produto.isKit) {
        // Se o produto for um kit, buscar os componentes do kit
        try {
          const response = await fetch(`/api/kits/${produtoId}`);
          const kitComponentes = await response.json();

          if (kitComponentes.length > 0) {
            // Adiciona os produtos do kit na lista de saída
            kitComponentes.forEach((componente: any) => {
              setSaidaProdutos((prev) => [
                ...prev,
                {
                  produtoId: componente.produtoId,
                  quantidade: componente.quantidade * quantidade, // Multiplica pela quantidade de kits
                  sku: componente.produto.sku,
                  isKit: false, // Produto individual dentro do kit
                },
              ]);
            });
          }
        } catch (error) {
          setMessage("Erro ao buscar componentes do kit");
          setMessageType("error");
          return;
        }
      } else {
        // Produto individual
        setSaidaProdutos((prev) => [
          ...prev,
          {
            produtoId,
            quantidade,
            sku: produto.sku,
            isKit: produto.isKit,
          },
        ]);
      }

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
        setMessage("Saída registrada com sucesso");
        setMessageType("success");
        setSaidaProdutos([]);
        setArmazemId(null);
      } else {
        const errorData = await response.json();
        setMessage(errorData.error || "Erro ao registrar saída");
        setMessageType("error");
      }
    } catch (error) {
      setMessage("Erro ao registrar saída");
      setMessageType("error");
    }
  };

  const handleSkuChange = async (value: string) => {
    setSku(value);

    try {
      // Primeiro, buscar se o SKU pertence a um produto individual
      const response = await fetch(`/api/produtos?sku=${value}`);
      if (response.ok) {
        const data = await response.json();
        if (data.length > 0) {
          setProdutoId(data[0].id);
          setMessage("");
          setMessageType("");
          return;
        }
      }

      // Se não for produto individual, verificar se é um kit
      const kitResponse = await fetch(`/api/kits?sku=${value}`);
      if (kitResponse.ok) {
        const kitData = await kitResponse.json();
        if (kitData.length > 0) {
          setProdutoId(kitData[0].id);
          setMessage("");
          setMessageType("");
          return;
        }
      }

      setProdutoId(null);
      setMessage("Produto ou Kit não encontrado");
      setMessageType("error");
    } catch (error) {
      setProdutoId(null);
      setMessage("Produto ou Kit não encontrado");
      setMessageType("error");
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white dark:bg-gray-900 rounded-md shadow-md">
      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
        Nova Saída
      </h1>
      <div className="mb-4">
        <label
          htmlFor="armazem"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Armazém
        </label>
        <select
          id="armazem"
          value={armazemId || ""}
          onChange={(e) => setArmazemId(Number(e.target.value))}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
        >
          <option value="" disabled>
            Selecione um armazém
          </option>
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
          SKU do Produto ou Kit
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
        type="button"
        onClick={handleAddProduto}
        className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        Adicionar Produto/Kit
      </button>

      <div className="mt-6">
        {saidaProdutos.length > 0 && (
          <>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Produtos Adicionados
            </h3>
            <ul className="mt-3">
              {saidaProdutos.map((p) => (
                <li
                  key={p.sku}
                  className="flex justify-between items-center py-2"
                >
                  <span>
                    {p.sku} (Quantidade: {p.quantidade})
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveProduto(p.sku)}
                    className="text-red-500"
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={handleRegistrarSaida}
        className="w-full mt-4 bg-green-600 text-white py-2 px-4 rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
      >
        Registrar Saída
      </button>

      {message && (
        <p
          className={`mt-4 text-center text-sm ${
            messageType === "error" ? "text-red-500" : "text-green-500"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
};

export default NovaSaida;
