import React, { useState, useEffect } from "react";

interface Produto {
  id: number;
  nome: string;
  sku: string;
}

interface Kit {
  id: number;
  nome: string;
  produtos: Produto[];
}

interface Armazem {
  id: number;
  nome: string;
}

const NovaSaida = () => {
  const [sku, setSku] = useState("");
  const [quantidade, setQuantidade] = useState(0);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [kits, setKits] = useState<Kit[]>([]);
  const [produtoId, setProdutoId] = useState<number | null>(null);
  const [isKit, setIsKit] = useState(false);
  const [saidaProdutos, setSaidaProdutos] = useState<
    { produtoId: number; quantidade: number; sku: string; isKit: boolean }[]
  >([]);
  const [armazens, setArmazens] = useState<Armazem[]>([]);
  const [armazemId, setArmazemId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  useEffect(() => {
    const fetchProdutos = async () => {
      try {
        const response = await fetch("/api/produtos");
        const data = await response.json();
        setProdutos(data);
      } catch (error) {
        console.error("Erro ao buscar produtos:", error);
      }
    };

    const fetchKits = async () => {
      try {
        const response = await fetch("/api/kits");
        const data = await response.json();
        setKits(data);
      } catch (error) {
        console.error("Erro ao buscar kits:", error);
      }
    };

    const fetchArmazens = async () => {
      try {
        const response = await fetch("/api/armazens");
        const data = await response.json();
        setArmazens(data);
      } catch (error) {
        console.error("Erro ao buscar armazéns:", error);
      }
    };

    fetchProdutos();
    fetchKits();
    fetchArmazens();
  }, []);

  const handleAddProduto = () => {
    if (!produtoId || quantidade <= 0) {
      setMessage(
        "Por favor, selecione um produto ou kit válido e quantidade maior que zero."
      );
      setMessageType("error");
      return;
    }

    const produto = produtos.find((p) => p.id === produtoId);
    const kit = kits.find((k) => k.id === produtoId);

    if (produto || kit) {
      setSaidaProdutos((prev) => [
        ...prev,
        {
          produtoId,
          quantidade,
          sku: produto ? produto.sku : kit!.nome,
          isKit,
        },
      ]);
      setSku("");
      setQuantidade(0);
      setProdutoId(null);
      setIsKit(false);
      setMessage("");
      setMessageType("");
    }
  };

  const handleRemoveProduto = (sku: string) => {
    setSaidaProdutos(saidaProdutos.filter((p) => p.sku !== sku));
  };

  const handleRegistrarSaida = async () => {
    if (saidaProdutos.length === 0 || !armazemId) {
      setMessage(
        "Por favor, adicione produtos ou kits e selecione um armazém."
      );
      setMessageType("error");
      return;
    }

    try {
      const response = await fetch("/api/saidas", {
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
        setMessage("Erro ao registrar saída.");
        setMessageType("error");
      }
    } catch (error) {
      console.error("Erro ao registrar saída:", error);
      setMessage("Erro ao registrar saída.");
      setMessageType("error");
    }
  };

  const handleSkuChange = (value: string) => {
    setSku(value);
    const produto = produtos.find((p) => p.sku === value);
    const kit = kits.find((k) => k.nome === value);

    if (produto) {
      setProdutoId(produto.id);
      setIsKit(false);
    } else if (kit) {
      setProdutoId(kit.id);
      setIsKit(true);
    } else {
      setProdutoId(null);
      setIsKit(false);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Registrar Saída de Produtos</h1>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700">
          SKU do Produto ou Nome do Kit
        </label>
        <input
          type="text"
          value={sku}
          onChange={(e) => handleSkuChange(e.target.value)}
          list="produtos"
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
        <datalist id="produtos">
          {produtos.map((produto) => (
            <option key={produto.id} value={produto.sku}>
              {produto.nome}
            </option>
          ))}
          {kits.map((kit) => (
            <option key={kit.id} value={kit.nome}>
              {kit.nome}
            </option>
          ))}
        </datalist>
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700">
          Quantidade
        </label>
        <input
          type="number"
          value={quantidade}
          onChange={(e) => setQuantidade(Number(e.target.value))}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700">
          Selecione o Armazém
        </label>
        <select
          value={armazemId || ""}
          onChange={(e) => setArmazemId(Number(e.target.value))}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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
      <button
        onClick={handleAddProduto}
        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
      >
        Adicionar Produto
      </button>

      {saidaProdutos.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xl font-bold mb-4">Produtos na Saída</h2>
          <ul className="space-y-4">
            {saidaProdutos.map((produto, index) => (
              <li
                key={index}
                className="flex justify-between items-center p-4 bg-gray-100 rounded-md shadow-sm"
              >
                <div>
                  <p className="text-lg font-semibold">
                    {produto.isKit ? "Kit" : "Produto"}: {produto.sku} -
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

      <button
        onClick={handleRegistrarSaida}
        className="mt-6 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
      >
        Registrar Saída
      </button>

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

export default NovaSaida;
