import { useEffect, useState } from "react";

interface Produto {
  id: number;
  nome: string;
  sku: string;
}

const CadastrarProdutoOuKit = () => {
  const [nome, setNome] = useState("");
  const [sku, setSku] = useState("");
  const [ean, setEan] = useState("");
  const [isKit, setIsKit] = useState(false);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [kitProdutos, setKitProdutos] = useState<
    { produtoId: number; quantidade: number }[]
  >([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredProdutos, setFilteredProdutos] = useState<Produto[]>([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [quantidades, setQuantidades] = useState<{ [key: number]: number }>({});

  useEffect(() => {
    const fetchProdutos = async () => {
      try {
        const response = await fetch("/api/produtos");
        const data = await response.json();
        if (Array.isArray(data)) {
          setProdutos(data);
        } else {
          console.error("Dados inválidos recebidos da API");
        }
      } catch (error) {
        console.error("Erro ao buscar produtos", error);
      }
    };

    fetchProdutos();
  }, []);

  useEffect(() => {
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
      ? {
          nome,
          sku,
          ean: ean || null, // Certifique-se de que o EAN seja tratado como opcional
          componentes: kitProdutos.map((kitProduto) => ({
            quantidade: kitProduto.quantidade,
            produtoId: kitProduto.produtoId,
          })),
        }
      : {
          nome,
          sku,
          ean: ean || null, // Certifique-se de que o EAN seja tratado como opcional
        };

    const endpoint = isKit ? "/api/kits" : "/api/produtos";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(produtoOuKit),
      });

      if (response.ok) {
        setMessage("Produto ou kit cadastrado com sucesso!");
        setMessageType("success");
        setNome("");
        setSku("");
        setEan("");
        setIsKit(false);
        setKitProdutos([]);
      } else {
        const errorData = await response.json();
        setMessage(errorData.error || "Erro ao cadastrar produto ou kit.");
        setMessageType("error");
      }
    } catch (error) {
      console.error("Erro ao cadastrar produto ou kit:", error);
      setMessage("Erro ao cadastrar produto ou kit.");
      setMessageType("error");
    }
  };

  const handleAddProdutoAoKit = (produtoId: number) => {
    const quantidade = quantidades[produtoId];
    if (quantidade > 0) {
      setKitProdutos((prevKitProdutos) => [
        ...prevKitProdutos,
        { produtoId, quantidade },
      ]);
      setQuantidades((prevQuantidades) => ({
        ...prevQuantidades,
        [produtoId]: 0,
      }));
    }
  };

  const handleRemoveProdutoDoKit = (produtoId: number) => {
    setKitProdutos((prevKitProdutos) =>
      prevKitProdutos.filter((p) => p.produtoId !== produtoId)
    );
  };

  const handleQuantidadeChange = (produtoId: number, quantidade: number) => {
    setQuantidades((prevQuantidades) => ({
      ...prevQuantidades,
      [produtoId]: quantidade,
    }));
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white dark:bg-gray-900 rounded-md shadow-md">
      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
        Cadastrar Produto ou Kit
      </h1>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label
            htmlFor="nome"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Nome
          </label>
          <input
            type="text"
            id="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          />
        </div>
        <div className="mb-4">
          <label
            htmlFor="sku"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            SKU
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
            htmlFor="ean"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            EAN
          </label>
          <input
            type="text"
            id="ean"
            value={ean}
            onChange={(e) => setEan(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          />
        </div>
        <div className="mb-4">
          <label
            htmlFor="isKit"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            É um Kit?
          </label>
          <input
            type="checkbox"
            id="isKit"
            checked={isKit}
            onChange={(e) => setIsKit(e.target.checked)}
            className="mt-1"
          />
        </div>
        {isKit && (
          <div className="mb-4">
            <label
              htmlFor="searchTerm"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Buscar Produtos
            </label>
            <input
              type="text"
              id="searchTerm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            />
            <ul className="mt-4">
              {filteredProdutos.map((produto) => (
                <li key={produto.id} className="flex items-center">
                  <span className="mr-2">
                    {produto.nome} (SKU: {produto.sku})
                  </span>
                  <input
                    type="number"
                    min="1"
                    value={quantidades[produto.id] || ""}
                    placeholder="Quantidade"
                    className="mr-2 w-20 p-1 border border-gray-300 rounded-md"
                    onChange={(e) =>
                      handleQuantidadeChange(
                        produto.id,
                        parseInt(e.target.value, 10)
                      )
                    }
                  />
                  <button
                    type="button"
                    onClick={() => handleAddProdutoAoKit(produto.id)}
                    className="bg-indigo-600 text-white py-1 px-2 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Adicionar
                  </button>
                </li>
              ))}
            </ul>
            <ul className="mt-4">
              {kitProdutos.map((kitProduto) => {
                const produto = produtos.find(
                  (p) => p.id === kitProduto.produtoId
                );
                return (
                  <li
                    key={kitProduto.produtoId}
                    className="flex justify-between items-center"
                  >
                    <span>
                      {produto?.nome} (SKU: {produto?.sku}) - Quantidade:{" "}
                      {kitProduto.quantidade}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleRemoveProdutoDoKit(kitProduto.produtoId)
                      }
                      className="bg-red-600 text-white py-1 px-2 rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      Remover
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <button
          type="submit"
          className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Cadastrar
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
