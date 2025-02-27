"use client";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Pedido, PedidoProduto, Armazem } from "../../types";
import { useFetch } from "../../../../hooks/useFetch";
import { FaEdit, FaTrash, FaCheck, FaChevronDown } from "react-icons/fa";

const PedidosPendentes = () => {
  const {
    data: pedidos,
    loading: pedidosLoading,
    error: pedidosError,
  } = useFetch<Pedido>("/api/pedidos-compra", (data) =>
    data.filter((pedido) => pedido.status === "pendente")
  );
  const {
    data: armazens,
    loading: armazensLoading,
    error: armazensError,
  } = useFetch<Armazem>("/api/estoque/criarArmazem");

  const [filteredPedidos, setFilteredPedidos] = useState<Pedido[]>([]);
  const [editPedido, setEditPedido] = useState<Pedido | null>(null);
  const [armazemId, setArmazemId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setFilteredPedidos(pedidos);
    console.log("Pedidos recebidos em Pendentes:", pedidos); // Debug
  }, [pedidos]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearch(value);
    const lowerCaseSearch = value.toLowerCase();
    setFilteredPedidos(
      pedidos.filter(
        (pedido) =>
          pedido.fornecedor.nome.toLowerCase().includes(lowerCaseSearch) ||
          pedido.produtos.some((produto) =>
            produto.produto?.sku.toLowerCase().includes(lowerCaseSearch)
          )
      )
    );
  };

  const handleConfirm = async (id: number) => {
    if (!armazemId) {
      setError("Selecione um armazém para confirmar o pedido");
      return;
    }

    const pedidoParaConfirmar = pedidos.find((pedido) => pedido.id === id);
    if (!pedidoParaConfirmar) return;

    try {
      const response = await fetch("/api/pedidos-compra", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pedidoId: id,
          armazemId,
          produtosRecebidos: pedidoParaConfirmar.produtos.map((p) => ({
            produtoId: p.produtoId,
            quantidade: p.quantidade,
            custo: p.custo,
            multiplicador: p.multiplicador || p.produto?.multiplicador || 1, // Usa o multiplicador do pedidoProduto
          })),
        }),
      });

      if (response.ok) {
        setFilteredPedidos((prev) => prev.filter((pedido) => pedido.id !== id));
        setEditPedido(null);
      } else {
        setError("Erro ao confirmar pedido");
      }
    } catch (error) {
      setError("Erro ao confirmar pedido");
    }
  };

  const handleEdit = (pedido: Pedido) => {
    setEditPedido({ ...pedido });
    setArmazemId(null);
  };

  const handleSave = async () => {
    if (!editPedido || !armazemId) return;

    const produtosRecebidos = editPedido.produtos.map((produto) => ({
      produtoId: produto.produtoId,
      quantidade: produto.quantidade,
      custo: produto.custo,
      multiplicador:
        produto.multiplicador || produto.produto?.multiplicador || 1, // Usa o multiplicador do pedidoProduto
    }));

    try {
      const response = await fetch("/api/pedidos-compra", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pedidoId: editPedido.id,
          armazemId,
          produtosRecebidos,
          comentarios: editPedido.comentarios,
        }),
      });

      if (response.ok) {
        setFilteredPedidos((prev) =>
          prev.filter((pedido) => pedido.id !== editPedido.id)
        );
        setEditPedido(null);
      } else {
        setError("Erro ao salvar alterações");
      }
    } catch (error) {
      setError("Erro ao salvar alterações");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch("/api/pedidos-compra", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedidoId: id }),
      });

      if (response.ok) {
        setFilteredPedidos((prev) => prev.filter((pedido) => pedido.id !== id));
      } else {
        setError("Erro ao deletar pedido");
      }
    } catch (error) {
      setError("Erro ao deletar pedido");
    }
  };

  const handleProdutoChange = (
    produtoId: number,
    field: keyof PedidoProduto,
    value: number
  ) => {
    if (!editPedido) return;
    const updatedProdutos = editPedido.produtos.map((produto) =>
      produto.produtoId === produtoId ? { ...produto, [field]: value } : produto
    );
    setEditPedido({ ...editPedido, produtos: updatedProdutos });
  };

  const calcularValorTotalPedido = (pedido: Pedido) =>
    pedido.produtos.reduce((subtotal, produto) => {
      const quantidade = produto.quantidade;
      const custo = produto.custo;
      const multiplicador =
        produto.multiplicador || produto.produto?.multiplicador || 1; // Prioriza o multiplicador do pedidoProduto
      return subtotal + quantidade * custo * multiplicador;
    }, 0);

  const calcularValorTotal = () =>
    filteredPedidos.reduce(
      (total, pedido) => total + calcularValorTotalPedido(pedido),
      0
    );

  const loading = pedidosLoading || armazensLoading;
  const combinedError = pedidosError || armazensError || error;

  if (loading)
    return (
      <p className="text-gray-500 dark:text-gray-400 text-center">
        Carregando...
      </p>
    );
  if (combinedError)
    return <p className="text-red-500 text-center">{combinedError}</p>;

  return (
    <div className="bg-white dark:bg-gray-900 shadow-xl rounded-xl p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-100 tracking-tight">
        Pedidos Pendentes
      </h2>
      <input
        type="text"
        value={search}
        onChange={handleSearchChange}
        placeholder="Pesquisar por fornecedor ou SKU"
        className="w-full p-3 mb-6 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <ul className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {filteredPedidos.map((pedido) => (
          <li
            key={pedido.id}
            className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200"
          >
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Pedido #{pedido.id}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(pedido)}
                  className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
                >
                  <FaEdit />
                </button>
                <button
                  onClick={() => handleDelete(pedido.id)}
                  className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                >
                  <FaTrash />
                </button>
              </div>
            </div>
            <p className="text-gray-700 dark:text-gray-300">
              <span className="font-medium">Fornecedor:</span>{" "}
              {pedido.fornecedor.nome}
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              <span className="font-medium">Comentários:</span>{" "}
              {pedido.comentarios || "Nenhum"}
            </p>
            {pedido.dataPrevista && (
              <p className="text-gray-700 dark:text-gray-300">
                <span className="font-medium">Data Prevista:</span>{" "}
                {format(new Date(pedido.dataPrevista), "dd/MM/yyyy", {
                  locale: ptBR,
                })}
              </p>
            )}
            <p className="text-gray-700 dark:text-gray-300 mt-2">
              <span className="font-medium">Valor Total:</span> R${" "}
              {calcularValorTotalPedido(pedido).toFixed(2)}
            </p>
          </li>
        ))}
      </ul>
      {editPedido && (
        <div className="mt-6 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg shadow-inner">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Editar Pedido #{editPedido.id}
          </h3>
          <textarea
            value={editPedido.comentarios}
            onChange={(e) =>
              setEditPedido({ ...editPedido, comentarios: e.target.value })
            }
            className="w-full p-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            rows={3}
            placeholder="Atualize os comentários..."
          />
          <div className="relative mt-4">
            <select
              value={armazemId || ""}
              onChange={(e) => setArmazemId(Number(e.target.value) || null)}
              className="w-full p-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
            >
              <option value="">Selecione um Armazém</option>
              {armazens.map((armazem) => (
                <option key={armazem.id} value={armazem.id}>
                  {armazem.nome}
                </option>
              ))}
            </select>
            <FaChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400" />
          </div>
          <div className="mt-4 space-y-4">
            {editPedido.produtos.map((produto) => (
              <div
                key={produto.produtoId}
                className="p-3 bg-white dark:bg-gray-700 rounded-lg shadow-sm"
              >
                <p className="text-gray-900 dark:text-gray-100 font-medium">
                  {produto.produto?.nome} (SKU: {produto.produto?.sku})
                </p>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <input
                    type="number"
                    value={produto.quantidade}
                    onChange={(e) =>
                      handleProdutoChange(
                        produto.produtoId,
                        "quantidade",
                        Number(e.target.value)
                      )
                    }
                    className="p-3 bg-gray-50 dark:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Quantidade"
                  />
                  <input
                    type="number"
                    value={produto.custo}
                    onChange={(e) =>
                      handleProdutoChange(
                        produto.produtoId,
                        "custo",
                        Number(e.target.value)
                      )
                    }
                    className="p-3 bg-gray-50 dark:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Custo"
                  />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Multiplicador:{" "}
                  {produto.multiplicador || produto.produto?.multiplicador || 1}{" "}
                  | Total: R${" "}
                  {(
                    produto.quantidade *
                    produto.custo *
                    (produto.multiplicador ||
                      produto.produto?.multiplicador ||
                      1)
                  ).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-md"
            >
              <FaCheck className="mr-2 inline" /> Salvar
            </button>
            <button
              onClick={() => handleConfirm(editPedido.id)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-md"
            >
              <FaCheck className="mr-2 inline" /> Confirmar
            </button>
          </div>
        </div>
      )}
      <div className="mt-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Total Geral: R$ {calcularValorTotal().toFixed(2)}
        </h3>
      </div>
    </div>
  );
};

export default PedidosPendentes;
