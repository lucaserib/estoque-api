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
  const [kitId, setKitId] = useState<number | null>(null);
  const [saidaProdutos, setSaidaProdutos] = useState<
    { kitId: number | null; quantidade: number; sku: string; isKit: boolean }[]
  >([]);
  const [armazens, setArmazens] = useState<Armazem[]>([]);
  const [armazemId, setArmazemId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  // Busca os armazéns ao carregar a página
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

  // Busca os produtos disponíveis no armazém selecionado
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
    if (!sku || quantidade <= 0) {
      setMessage(
        "Por favor, insira um SKU válido e quantidade maior que zero."
      );
      setMessageType("error");
      return;
    }

    try {
      // Buscar o produto ou kit pelo SKU
      const response = await fetch(`/api/produtos?sku=${sku}`);
      const produto = await response.json();

      if (!produto || produto.length === 0) {
        setMessage("Produto ou Kit não encontrado.");
        setMessageType("error");
        return;
      }

      const produtoEncontrado = produto[0];

      // Adicionar o produto ou kit diretamente à lista de saída
      setSaidaProdutos((prev) => [
        ...prev,
        {
          kitId: produtoEncontrado.isKit ? produtoEncontrado.id : null,
          quantidade,
          sku: produtoEncontrado.sku,
          isKit: produtoEncontrado.isKit,
        },
      ]);

      // Resetar campos
      setSku("");
      setQuantidade(0);
      setMessage("");
      setMessageType("");
    } catch (error) {
      setMessage("Erro ao adicionar produto ou kit.");
      setMessageType("error");
    }
  };
  // Remove o produto ou kit da lista
  const handleRemoveProduto = (sku: string) => {
    setSaidaProdutos(saidaProdutos.filter((p) => p.sku !== sku));
  };

  // Registrar a saída dos produtos
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
        setMessage("Saída registrada com sucesso.");
        setMessageType("success");
        setSaidaProdutos([]);
      } else {
        const errorData = await response.json();
        setMessage(errorData.error || "Erro ao registrar saída.");
        setMessageType("error");
      }
    } catch (error) {
      setMessage("Erro ao registrar saída.");
      setMessageType("error");
    }
  };
  // Verificar se o SKU é de um produto individual ou kit
  const handleSkuChange = async (value: string) => {
    setSku(value);

    try {
      // Primeiro, buscar o SKU de um produto
      const response = await fetch(`/api/produtos?sku=${value}`);
      if (response.ok) {
        const data = await response.json();
        if (data.length > 0) {
          setKitId(null);
          setMessage("");
          setMessageType("");
          return;
        }
      }

      // Se não for produto, buscar o SKU de um kit
      const kitResponse = await fetch(`/api/kits?sku=${value}`);
      if (kitResponse.ok) {
        const kitData = await kitResponse.json();
        if (kitData.length > 0) {
          setKitId(kitData[0].id);
          setMessage("");
          setMessageType("");
          return;
        }
      }

      setKitId(null);
      setMessage("Produto ou Kit não encontrado");
      setMessageType("error");
    } catch (error) {
      setKitId(null);
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
        onClick={handleAddProduto}
        className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none"
      >
        Adicionar Produto/Kit
      </button>

      <ul className="mt-4">
        {saidaProdutos.map((item) => (
          <li key={item.sku} className="flex justify-between py-2">
            <span>
              {item.sku} - {item.quantidade}{" "}
              {item.isKit ? "Kit(s)" : "Produto(s)"}
            </span>
            <button
              onClick={() => handleRemoveProduto(item.sku)}
              className="text-red-600 hover:text-red-900"
            >
              Remover
            </button>
          </li>
        ))}
      </ul>

      {message && (
        <div
          className={`mt-4 p-2 rounded-md text-white ${
            messageType === "success" ? "bg-green-500" : "bg-red-500"
          }`}
        >
          {message}
        </div>
      )}

      <button
        onClick={handleRegistrarSaida}
        className="w-full bg-green-600 text-white py-2 px-4 mt-4 rounded-md shadow-sm hover:bg-green-700 focus:outline-none"
      >
        Registrar Saída
      </button>
    </div>
  );
};

export default NovaSaida;
