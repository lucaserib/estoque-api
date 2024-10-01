import { useState, useEffect } from "react";

const NovoPedido = () => {
  interface Fornecedor {
    id: number;
    nome: string;
  }

  interface Produto {
    id: number;
    nome: string;
    sku: string;
  }

  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [fornecedorNome, setFornecedorNome] = useState("");
  const [fornecedorId, setFornecedorId] = useState<number | null>(null);
  const [novoProduto, setNovoProduto] = useState({
    produtoId: "",
    quantidade: "",
    custo: "",
    sku: "",
  });
  const [produtosPedido, setProdutosPedido] = useState<
    { produtoId: string; quantidade: string; custo: string; sku: string }[]
  >([]);
  const [comentarios, setComentarios] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  useEffect(() => {
    const fetchFornecedores = async () => {
      const response = await fetch("/api/fornecedores");
      const data = await response.json();
      setFornecedores(data);
    };

    const fetchProdutos = async () => {
      const response = await fetch("/api/produtos");
      const data = await response.json();
      setProdutos(data);
    };

    fetchFornecedores();
    fetchProdutos();
  }, []);

  const handleProdutoChange = (field: string, value: string) => {
    setNovoProduto({ ...novoProduto, [field]: value });
  };

  const handleAddProduto = () => {
    // Verificar se todos os campos de novo produto estão preenchidos
    if (
      !novoProduto.produtoId ||
      !novoProduto.quantidade ||
      !novoProduto.custo ||
      !novoProduto.sku
    ) {
      setMessage(
        "Por favor, preencha todos os campos para adicionar um novo produto."
      );
      setMessageType("error");
      return;
    }

    // Adicionar o produto à lista de produtos do pedido
    setProdutosPedido([...produtosPedido, { ...novoProduto }]);
    setNovoProduto({ produtoId: "", quantidade: "", custo: "", sku: "" });
    setMessage("");
    setMessageType("");
  };

  const handleRemoveProduto = (index: number) => {
    const newProdutos = produtosPedido.filter((_, i) => i !== index);
    setProdutosPedido(newProdutos);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fornecedorId) {
      setMessage("Por favor, selecione um fornecedor válido.");
      setMessageType("error");
      return;
    }

    const pedido = {
      fornecedorId,
      produtos: produtosPedido.map((produto) => ({
        produtoId: Number(produto.produtoId),
        quantidade: Number(produto.quantidade),
        custo: Number(produto.custo),
      })),
      comentarios,
    };

    try {
      const response = await fetch("/api/pedidos-compra", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(pedido),
      });

      if (response.ok) {
        setMessage("Pedido de compra criado com sucesso!");
        setMessageType("success");
        setFornecedorNome("");
        setFornecedorId(null);
        setProdutosPedido([]);
        setComentarios("");
      } else {
        setMessage("Erro ao criar pedido de compra.");
        setMessageType("error");
      }
    } catch (error) {
      console.error("Erro ao criar pedido de compra:", error);
      setMessage("Erro ao criar pedido de compra.");
      setMessageType("error");
    }
  };

  const handleProdutoSearch = (value: string) => {
    const produto = produtos.find((p) => p.sku === value);
    if (produto) {
      setNovoProduto({
        ...novoProduto,
        produtoId: produto.id.toString(),
        sku: produto.sku,
      });
    } else {
      setNovoProduto({ ...novoProduto, produtoId: "", sku: value });
    }
  };

  const handleFornecedorChange = (value: string) => {
    setFornecedorNome(value);
    const fornecedor = fornecedores.find((f) => f.nome === value);
    if (fornecedor) {
      setFornecedorId(fornecedor.id);
    } else {
      setFornecedorId(null);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white dark:bg-gray-900 rounded-md shadow-md">
      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
        Novo Pedido de Compra
      </h1>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Fornecedor
          </label>
          <input
            type="text"
            list="fornecedores"
            value={fornecedorNome}
            onChange={(e) => handleFornecedorChange(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            required
          />
          <datalist id="fornecedores">
            {fornecedores.map((fornecedor) => (
              <option key={fornecedor.id} value={fornecedor.nome} />
            ))}
          </datalist>
        </div>

        {/* Caixas de inserção para adicionar novos produtos */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Produto (SKU)
          </label>
          <input
            type="text"
            value={novoProduto.sku}
            onChange={(e) => handleProdutoSearch(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            list="produtos"
          />
          <datalist id="produtos">
            {produtos
              .filter((p) => p.sku.includes(novoProduto.sku))
              .map((p) => (
                <option key={p.id} value={p.sku}>
                  {p.nome}
                </option>
              ))}
          </datalist>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mt-2">
            Quantidade
          </label>
          <input
            type="number"
            value={novoProduto.quantidade}
            onChange={(e) => handleProdutoChange("quantidade", e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mt-2">
            Custo
          </label>
          <input
            type="number"
            value={novoProduto.custo}
            onChange={(e) => handleProdutoChange("custo", e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>

        <button
          type="button"
          onClick={handleAddProduto}
          className="w-full py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
        >
          Adicionar Produto
        </button>

        <div className="mb-4 mt-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Comentários
          </label>
          <textarea
            value={comentarios}
            onChange={(e) => setComentarios(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>

        {/* Exibir lista de produtos já adicionados */}
        {produtosPedido.length > 0 && (
          <div className="mt-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
              Produtos Adicionados
            </h2>
            <ul className="space-y-4">
              {produtosPedido.map((produto, index) => (
                <li key={index} className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-900 dark:text-gray-100">
                      <strong>SKU:</strong> {produto.sku}
                    </p>
                    <p className="text-gray-900 dark:text-gray-100">
                      <strong>Quantidade:</strong> {produto.quantidade}
                    </p>
                    <p className="text-gray-900 dark:text-gray-100">
                      <strong>Custo:</strong> R$ {produto.custo}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveProduto(index)}
                    className="text-red-600 hover:text-red-800"
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6">
          <button
            type="submit"
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          >
            Confirmar Pedido de Compra
          </button>
        </div>

        {message && (
          <p
            className={`mt-4 text-sm ${
              messageType === "success" ? "text-green-600" : "text-red-600"
            }`}
          >
            {message}
          </p>
        )}
      </form>
    </div>
  );
};

export default NovoPedido;
