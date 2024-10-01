import { useEffect, useState } from "react";

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
    setKitProdutos((prevKitProdutos) => [
      ...prevKitProdutos,
      { produtoId, quantidade },
    ]);
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
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Nome
          </label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border rounded-md shadow-lg"
            required
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            SKU
          </label>
          <input
            type="text"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border rounded-md shadow-lg"
            required
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Tipo
          </label>
          <select
            value={isKit ? "kit" : "produto"}
            onChange={(e) => setIsKit(e.target.value === "kit")}
            className="mt-1 block w-full px-3 py-2 border rounded-md shadow-lg"
          >
            <option value="produto">Produto</option>
            <option value="kit">Kit</option>
          </select>
        </div>

        {isKit && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Selecionar Produtos para o Kit
            </label>
            <input
              type="text"
              placeholder="Buscar produtos por nome ou SKU"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border rounded-md shadow-lg"
            />
            {filteredProdutos.length > 0 && (
              <ul className="mt-2 space-y-2 max-h-48 overflow-y-auto bg-gray-50 dark:bg-gray-700 p-2 rounded-md">
                {filteredProdutos.map((produto) => (
                  <li
                    key={produto.id}
                    className="flex justify-between items-center"
                  >
                    <span>
                      {produto.nome} (SKU: {produto.sku})
                    </span>
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        min="1"
                        placeholder="Quantidade"
                        className="w-20 px-2 py-1 border rounded-md"
                        id={`quantidade-${produto.id}`}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          handleAddProdutoAoKit(
                            produto.id,
                            Number(
                              (
                                document.getElementById(
                                  `quantidade-${produto.id}`
                                ) as HTMLInputElement
                              ).value
                            )
                          )
                        }
                        className="text-green-500 hover:text-green-700"
                      >
                        Adicionar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Produtos selecionados para o kit */}
            {kitProdutos.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Produtos no Kit:
                </h3>
                <ul className="space-y-2">
                  {kitProdutos.map((kitProduto, index) => {
                    const produto = produtos.find(
                      (p) => p.id === kitProduto.produtoId
                    );
                    return (
                      <li
                        key={index}
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
                          className="text-red-500 hover:text-red-700"
                        >
                          Remover
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
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
