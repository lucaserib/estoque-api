import React, { useEffect, useState } from "react";

interface Produto {
  id: number;
  nome: string;
  sku: string;
  isKit: boolean;
  quantidade: number; // Adiciona a propriedade quantidade
}

interface Armazem {
  id: number;
  nome: string;
}

const NovaSaida = () => {
  const [sku, setSku] = useState("");
  const [quantidade, setQuantidade] = useState(0);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [saidaProdutos, setSaidaProdutos] = useState<
    {
      produtoId: number;
      quantidade: number;
      sku: string;
      isHidden?: boolean;
      isKit?: boolean;
      componentes?: { produtoId: number; quantidade: number; sku: string }[];
    }[]
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
        // Se não encontrar o produto, verificar se é um kit
        const kitResponse = await fetch(`/api/kits?sku=${sku}`);
        const kit = await kitResponse.json();

        if (!kit || kit.length === 0) {
          setMessage("Produto ou Kit não encontrado.");
          setMessageType("error");
          return;
        }

        const kitEncontrado = kit[0];

        // Adicionar o kit à lista de saída para exibição na UI
        setSaidaProdutos((prevSaidaProdutos) => {
          // Verificar se o kit já está na lista
          const kitExistente = prevSaidaProdutos.find(
            (p) => p.produtoId === kitEncontrado.id && p.isKit
          );

          if (kitExistente) {
            // Atualizar a quantidade do kit existente
            kitExistente.quantidade += quantidade;
          } else {
            // Adicionar novo kit à lista
            prevSaidaProdutos.push({
              produtoId: kitEncontrado.id,
              quantidade,
              sku: kitEncontrado.sku,
              isKit: true,
              componentes: kitEncontrado.componentes.map(
                (componente: { produto: Produto; quantidade: number }) => ({
                  produtoId: componente.produto.id,
                  quantidade: componente.quantidade * quantidade,
                  sku: componente.produto.sku,
                })
              ),
            });
          }

          return [...prevSaidaProdutos]; // Retorna o array atualizado
        });
      } else {
        // Se for um produto normal, adicionar diretamente
        const produtoEncontrado = produto[0];
        setSaidaProdutos((prevSaidaProdutos) => {
          const produtoExistente = prevSaidaProdutos.find(
            (p) => p.produtoId === produtoEncontrado.id && !p.isKit
          );

          if (produtoExistente) {
            // Atualizar a quantidade do produto existente
            produtoExistente.quantidade += quantidade;
          } else {
            // Adicionar novo produto à lista
            prevSaidaProdutos.push({
              produtoId: produtoEncontrado.id,
              quantidade,
              sku: produtoEncontrado.sku,
              isKit: false,
            });
          }

          return [...prevSaidaProdutos]; // Retorna o array atualizado
        });
      }

      // Resetar campos
      setSku("");
      setQuantidade(0);
      setMessage("");
      setMessageType("");
    } catch (error) {
      setMessage("Erro ao adicionar produto ou kit.");
      setMessageType("error");
      console.error("Erro ao adicionar produto ou kit:", error);
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
      console.error("Erro ao registrar saída:", error);
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
          onChange={(e) => setSku(e.target.value)}
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
        className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
      >
        Adicionar Produto/Kit
      </button>

      <div className="mt-6">
        <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-gray-100">
          Produtos/Itens na Saída
        </h2>
        {saidaProdutos.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">
            Nenhum produto adicionado.
          </p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {saidaProdutos
              .filter((produto) => !produto.isHidden)
              .map((produto) => (
                <li
                  key={produto.sku}
                  className="py-4 flex justify-between items-center"
                >
                  <span>
                    {produto.isKit ? (
                      // Exibe detalhes do kit
                      <>
                        {produto.sku} (Kit) - Quantidade: {produto.quantidade}
                      </>
                    ) : (
                      // Exibe detalhes de produtos individuais
                      <>
                        {produto.sku} - Quantidade: {produto.quantidade}
                      </>
                    )}
                  </span>
                  <button
                    onClick={() => handleRemoveProduto(produto.sku)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Remover
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>

      <button
        onClick={handleRegistrarSaida}
        className="mt-6 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
      >
        Registrar Saída
      </button>

      {message && (
        <div
          className={`mt-4 p-2 rounded-md ${
            messageType === "success"
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {message}
        </div>
      )}
    </div>
  );
};

export default NovaSaida;
