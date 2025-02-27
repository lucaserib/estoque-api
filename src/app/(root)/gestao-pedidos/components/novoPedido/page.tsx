"use client";
import { useState, useEffect } from "react";
import { Fornecedor, FornecedorProduto } from "../../types";
import { FaPlus, FaTrash, FaChevronDown } from "react-icons/fa";

const NovoPedido = () => {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [fornecedorProduto, setFornecedorProduto] = useState<
    FornecedorProduto[]
  >([]);
  const [fornecedorId, setFornecedorId] = useState<number | null>(null);
  const [novoProduto, setNovoProduto] = useState({
    produtoId: "",
    quantidade: "",
    custo: "",
    sku: "",
    codigoNF: "",
    multiplicador: "",
  });
  const [produtosPedido, setProdutosPedido] = useState<
    {
      produtoId: string;
      quantidade: string;
      custo: string;
      sku: string;
      codigoNF: string;
      multiplicador: string;
    }[]
  >([]);
  const [comentarios, setComentarios] = useState("");
  const [dataPrevista, setDataPrevista] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  useEffect(() => {
    const fetchFornecedores = async () => {
      const response = await fetch("/api/fornecedores");
      const data = await response.json();
      if (Array.isArray(data)) setFornecedores(data);
    };
    fetchFornecedores();
  }, []);

  useEffect(() => {
    const fetchProdutoFornecedores = async () => {
      if (fornecedorId) {
        const response = await fetch(
          `/api/produto-fornecedor?fornecedorId=${fornecedorId}`
        );
        const data = await response.json();
        if (Array.isArray(data)) setFornecedorProduto(data);
      }
    };
    fetchProdutoFornecedores();
  }, [fornecedorId]);

  const handleProdutoChange = (field: string, value: string) =>
    setNovoProduto({ ...novoProduto, [field]: value });

  const handleRemoveProduto = (index: number) => {
    setProdutosPedido((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fornecedorId || produtosPedido.length === 0) {
      setMessage(
        !fornecedorId
          ? "Selecione um fornecedor"
          : "Adicione pelo menos um produto"
      );
      setMessageType("error");
      return;
    }

    const pedido = {
      fornecedorId,
      produtos: produtosPedido.map((p) => ({
        produtoId: Number(p.produtoId),
        quantidade: Number(p.quantidade),
        custo: Number(p.custo),
        multiplicador: Number(p.multiplicador) || 1, // Inclui o multiplicador
      })),
      comentarios,
      dataPrevista: dataPrevista
        ? new Date(dataPrevista).toISOString()
        : undefined,
    };

    try {
      const response = await fetch("/api/pedidos-compra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pedido),
      });
      if (response.ok) {
        setMessage("Pedido criado com sucesso!");
        setMessageType("success");
        setFornecedorId(null);
        setProdutosPedido([]);
        setComentarios("");
        setDataPrevista("");
        setNovoProduto({
          produtoId: "",
          quantidade: "",
          custo: "",
          sku: "",
          codigoNF: "",
          multiplicador: "",
        });
      } else {
        setMessage("Erro ao criar pedido");
        setMessageType("error");
      }
    } catch (error) {
      setMessage("Erro ao criar pedido");
      setMessageType("error");
    }
  };

  const handleProdutoSearch = (sku: string) => {
    const produtoFornecedor = fornecedorProduto.find(
      (pf) => pf.produto.sku === sku
    );
    if (produtoFornecedor) {
      setNovoProduto({
        ...novoProduto,
        sku: produtoFornecedor.produto.sku,
        produtoId: produtoFornecedor.produtoId.toString(),
        custo: produtoFornecedor.preco.toString(),
        codigoNF: produtoFornecedor.codigoNF,
        multiplicador: produtoFornecedor.multiplicador.toString(),
      });
    } else {
      setNovoProduto({ ...novoProduto, sku, produtoId: "" });
    }
  };

  const handleAddProduto = () => {
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
    setProdutosPedido((prev) => [...prev, { ...novoProduto }]);
    setNovoProduto({
      produtoId: "",
      quantidade: "",
      custo: "",
      sku: "",
      codigoNF: "",
      multiplicador: "",
    });
  };

  const calcularValorTotal = () =>
    produtosPedido.reduce((total, produto) => {
      const quantidade = Number(produto.quantidade);
      const custo = Number(produto.custo);
      const multiplicador = Number(produto.multiplicador) || 1;
      return total + quantidade * custo * multiplicador;
    }, 0);

  return (
    <div className="bg-white dark:bg-gray-900 shadow-xl rounded-xl p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-100 tracking-tight">
        Criar Novo Pedido
      </h2>
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Fornecedor
            </label>
            <div className="relative">
              <select
                value={fornecedorId || ""}
                onChange={(e) =>
                  setFornecedorId(Number(e.target.value) || null)
                }
                className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
              >
                <option value="">Selecione um fornecedor</option>
                {fornecedores.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
              <FaChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Data Prevista
            </label>
            <input
              type="date"
              value={dataPrevista}
              onChange={(e) => setDataPrevista(e.target.value)}
              className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Comentários
            </label>
            <textarea
              value={comentarios}
              onChange={(e) => setComentarios(e.target.value)}
              className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              rows={3}
              placeholder="Digite seus comentários aqui..."
            />
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg shadow-inner">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Adicionar Produtos
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 mb-6">
            <div className="sm:col-span-2 relative">
              <select
                value={novoProduto.sku}
                onChange={(e) => handleProdutoSearch(e.target.value)}
                className="w-full p-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
              >
                <option value="">Selecione um SKU</option>
                {fornecedorProduto.map((pf) => (
                  <option key={pf.produtoId} value={pf.produto.sku}>
                    {pf.produto.sku} - {pf.produto.nome}
                  </option>
                ))}
              </select>
              <FaChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400" />
            </div>
            <input
              type="number"
              placeholder="Quantidade"
              value={novoProduto.quantidade}
              onChange={(e) =>
                handleProdutoChange("quantidade", e.target.value)
              }
              className="p-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="text"
              placeholder="Custo"
              value={novoProduto.custo}
              readOnly
              className="p-3 bg-gray-100 dark:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-200"
            />
            <button
              type="button"
              onClick={handleAddProduto}
              className="flex items-center justify-center px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200 shadow-md"
            >
              <FaPlus className="mr-2" /> Adicionar
            </button>
          </div>
          {produtosPedido.length > 0 && (
            <ul className="space-y-3">
              {produtosPedido.map((produto, index) => (
                <li
                  key={index}
                  className="flex justify-between items-center p-3 bg-white dark:bg-gray-700 rounded-lg shadow-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-150"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-gray-900 dark:text-gray-200">
                      {produto.sku}
                    </span>
                    <span className="text-gray-700 dark:text-gray-300">
                      Qtd: {produto.quantidade}
                    </span>
                    <span className="text-gray-700 dark:text-gray-300">
                      R${" "}
                      {(
                        Number(produto.custo) *
                        Number(produto.multiplicador || 1)
                      ).toFixed(2)}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveProduto(index)}
                    className="text-red-600 hover:text-red-800 dark:text-red-500 dark:hover:text-red-700 transition-colors duration-150"
                  >
                    <FaTrash />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Valor Total: R$ {calcularValorTotal().toFixed(2)}
          </h3>
          <button
            type="submit"
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200 shadow-md"
          >
            Criar Pedido
          </button>
        </div>

        {message && (
          <p
            className={`mt-4 text-center text-sm font-medium px-3 py-2 rounded-lg ${
              messageType === "success"
                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
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
