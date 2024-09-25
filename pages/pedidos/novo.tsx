import { useState, useEffect } from "react";

const NovoPedido = () => {
  interface Fornecedor {
    id: number;
    nome: string;
  }

  interface Produto {
    id: number;
    nome: string;
  }

  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [fornecedorId, setFornecedorId] = useState("");
  const [produtoId, setProdutoId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [custo, setCusto] = useState("");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const pedido = {
      fornecedorId: Number(fornecedorId),
      produtos: [
        {
          produtoId: Number(produtoId),
          quantidade: Number(quantidade),
          custo: Number(custo),
        },
      ],
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
        setFornecedorId("");
        setProdutoId("");
        setQuantidade("");
        setCusto("");
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
          <select
            value={fornecedorId}
            onChange={(e) => setFornecedorId(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            required
          >
            <option value="">Selecione um fornecedor</option>
            {fornecedores.map((fornecedor) => (
              <option key={fornecedor.id} value={fornecedor.id}>
                {fornecedor.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Produto
          </label>
          <select
            value={produtoId}
            onChange={(e) => setProdutoId(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            required
          >
            <option value="">Selecione um produto</option>
            {produtos.map((produto) => (
              <option key={produto.id} value={produto.id}>
                {produto.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Quantidade
          </label>
          <input
            type="number"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            required
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Custo
          </label>
          <input
            type="number"
            value={custo}
            onChange={(e) => setCusto(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            required
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Comentários
          </label>
          <textarea
            value={comentarios}
            onChange={(e) => setComentarios(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>
        <button
          type="submit"
          className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
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
