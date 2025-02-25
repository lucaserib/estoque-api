"use client";

import { useEffect, useState } from "react";
import { Fornecedor, FornecedorProduto } from "../../types";

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
      try {
        const response = await fetch("/api/fornecedores");
        const data = await response.json();
        if (Array.isArray(data)) setFornecedores(data);
      } catch (error) {
        console.error("Erro ao buscar fornecedores", error);
      }
    };
    fetchFornecedores();
  }, []);

  useEffect(() => {
    const fetchProdutoFornecedores = async () => {
      if (fornecedorId) {
        try {
          const response = await fetch(
            `/api/produto-fornecedor?fornecedorId=${fornecedorId}`
          );
          const data = await response.json();
          if (Array.isArray(data)) setFornecedorProduto(data);
        } catch (error) {
          console.error("Erro ao buscar produtos do fornecedor", error);
        }
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
          : "Adicione pelo menos um produto ao pedido"
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
    <div>
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
        Criar Novo Pedido
      </h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Fornecedor
            </label>
            <select
              value={fornecedorId || ""}
              onChange={(e) => setFornecedorId(Number(e.target.value || null))}
              className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecione um fornecedor</option>
              {fornecedores.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Data Prevista
            </label>
            <input
              type="date"
              value={dataPrevista}
              onChange={(e) => setDataPrevista(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Comentários
            </label>
            <textarea
              value={comentarios}
              onChange={(e) => setComentarios(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
            Produtos
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 mb-4">
            <select
              value={novoProduto.sku}
              onChange={(e) => handleProdutoSearch(e.target.value)}
              className="col-span-2 p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecione um SKU</option>
              {fornecedorProduto.map((pf) => (
                <option key={pf.produtoId} value={pf.produto.sku}>
                  {pf.produto.sku}
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Quantidade"
              value={novoProduto.quantidade}
              onChange={(e) =>
                handleProdutoChange("quantidade", e.target.value)
              }
              className="p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Custo"
              value={novoProduto.custo}
              readOnly
              className="p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:text-gray-200"
            />
            <button
              type="button"
              onClick={handleAddProduto}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Adicionar
            </button>
          </div>
          <ul className="space-y-2">
            {produtosPedido.map((produto, index) => (
              <li
                key={index}
                className="flex justify-between items-center p-2 bg-gray-100 dark:bg-gray-700 rounded-md"
              >
                <span>{produto.sku}</span>
                <span>{produto.quantidade}</span>
                <span>R$ {produto.custo}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveProduto(index)}
                  className="px-2 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Valor Total: R$ {calcularValorTotal().toFixed(2)}
          </h3>
        </div>

        {message && (
          <div
            className={`p-2 rounded-md ${
              messageType === "success"
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {message}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Criar Pedido
          </button>
        </div>
      </form>
    </div>
  );
};
export default NovoPedido;
