import { useEffect, useState } from "react";

interface Fornecedor {
  id: number;
  nome: string;
}

interface Produto {
  id: number;
  nome: string;
  sku: string;
}

const NovoPedido = () => {
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
      try {
        const response = await fetch("/api/fornecedores");
        const data = await response.json();
        if (Array.isArray(data)) {
          setFornecedores(data);
        } else {
          console.error("Dados inválidos recebidos da API");
        }
      } catch (error) {
        console.error("Erro ao buscar fornecedores", error);
      }
    };

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

    fetchFornecedores();
    fetchProdutos();
  }, []);

  const handleProdutoChange = (field: string, value: string) => {
    setNovoProduto({ ...novoProduto, [field]: value });
  };

  // Removed duplicate handleAddProduto function

  const handleRemoveProduto = (index: number) => {
    const newProdutosPedido = [...produtosPedido];
    newProdutosPedido.splice(index, 1);
    setProdutosPedido(newProdutosPedido);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fornecedorId) {
      setMessage("Selecione um fornecedor");
      setMessageType("error");
      return;
    }

    if (produtosPedido.length === 0) {
      setMessage("Adicione pelo menos um produto ao pedido");
      setMessageType("error");
      return;
    }

    const pedido = {
      fornecedorId,
      produtos: produtosPedido.map((p) => ({
        produtoId: Number(p.produtoId),
        quantidade: Number(p.quantidade),
        custo: Number(p.custo),
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
        setMessage("Pedido criado com sucesso!");
        setMessageType("success");
        setFornecedorId(null);
        setProdutosPedido([]);
        setComentarios("");
      } else {
        setMessage("Erro ao criar pedido");
        setMessageType("error");
      }
    } catch (error) {
      console.error("Erro ao criar pedido:", error);
      setMessage("Erro ao criar pedido");
      setMessageType("error");
    }
  };

  const handleProdutoSearch = (sku: string) => {
    const produtoSelecionado = produtos.find((p) => p.sku === sku);

    if (produtoSelecionado) {
      setNovoProduto({
        ...novoProduto,
        sku: produtoSelecionado.sku,
        produtoId: produtoSelecionado.id.toString(), // Certifica-se que o ID é corretamente atribuído
      });
    } else {
      setNovoProduto({
        ...novoProduto,
        sku: sku,
        produtoId: "", // Limpa o produtoId caso o SKU não seja encontrado
      });
    }
  };

  const handleAddProduto = () => {
    // Validação dos campos
    if (
      !novoProduto.produtoId ||
      !novoProduto.quantidade ||
      !novoProduto.custo ||
      !novoProduto.sku
    ) {
      setMessage("Preencha todos os campos do produto");
      setMessageType("error");
      return;
    }

    // Adiciona o produto à lista
    setProdutosPedido([...produtosPedido, { ...novoProduto }]);
    setNovoProduto({ produtoId: "", quantidade: "", custo: "", sku: "" });
  };

  const handleFornecedorChange = (value: string) => {
    const fornecedor = fornecedores.find((f) => f.nome === value);
    if (fornecedor) {
      setFornecedorId(fornecedor.id);
      setFornecedorNome(fornecedor.nome);
    } else {
      setFornecedorId(null);
      setFornecedorNome(value);
    }
  };

  return (
    <div className="max-w-4xl mx-auto mt-10 p-6 bg-white dark:bg-gray-900 rounded-md shadow-md">
      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
        Novo Pedido
      </h1>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label
            htmlFor="fornecedor"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Fornecedor
          </label>
          <input
            type="text"
            id="fornecedor"
            value={fornecedorNome}
            onChange={(e) => handleFornecedorChange(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            list="fornecedores"
          />
          <datalist id="fornecedores">
            {fornecedores.map((fornecedor) => (
              <option key={fornecedor.id} value={fornecedor.nome} />
            ))}
          </datalist>
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
            value={novoProduto.sku}
            onChange={(e) => handleProdutoSearch(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
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
            value={novoProduto.quantidade}
            onChange={(e) => handleProdutoChange("quantidade", e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          />
        </div>
        <div className="mb-4">
          <label
            htmlFor="custo"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Custo
          </label>
          <input
            type="number"
            id="custo"
            value={novoProduto.custo}
            onChange={(e) => handleProdutoChange("custo", e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          />
        </div>
        <button
          type="button"
          onClick={handleAddProduto}
          className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Adicionar Produto
        </button>
        <ul className="mt-4 space-y-2">
          {produtosPedido.map((produto, index) => (
            <li
              key={index}
              className="flex justify-between items-center p-4 bg-gray-100 dark:bg-gray-700 rounded-md shadow-sm"
            >
              <div>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {produto.sku}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Quantidade: {produto.quantidade} | Custo: {produto.custo}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveProduto(index)}
                className="text-red-600 hover:text-red-900"
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <label
            htmlFor="comentarios"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Comentários
          </label>
          <textarea
            id="comentarios"
            value={comentarios}
            onChange={(e) => setComentarios(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mt-4"
        >
          Criar Pedido
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

export default NovoPedido;
