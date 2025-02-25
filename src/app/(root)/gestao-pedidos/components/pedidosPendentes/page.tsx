// app/gestao-pedidos/components/PedidosPendentes.tsx
"use client";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Pedido, PedidoProduto, Armazem } from "../../types"; // Adjust path as needed
import { useFetch } from "../../hooks/useFetch";

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

  const [filteredPedidos, setFilteredPedidos] = useState<Pedido[]>(pedidos);
  const [editPedido, setEditPedido] = useState<Pedido | null>(null);
  const [armazemId, setArmazemId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  // Sync filteredPedidos with pedidos when pedidos changes
  useEffect(() => {
    setFilteredPedidos(pedidos);
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
      setError("Armazém é obrigatório para confirmar o pedido");
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
          produtosRecebidos: pedidoParaConfirmar.produtos,
        }),
      });

      if (response.ok) {
        setFilteredPedidos((prev) => prev.filter((pedido) => pedido.id !== id));
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
      const multiplicador = produto.produto?.multiplicador || 1;
      return subtotal + quantidade * custo * multiplicador;
    }, 0);

  const calcularValorTotal = () =>
    filteredPedidos.reduce(
      (total, pedido) => total + calcularValorTotalPedido(pedido),
      0
    );

  // Combine loading and error states
  const loading = pedidosLoading || armazensLoading;
  const combinedError = pedidosError || armazensError || error;

  if (loading)
    return <p className="text-gray-500 dark:text-gray-400">Carregando...</p>;
  if (combinedError) return <p className="text-red-500">{combinedError}</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
        Pedidos Pendentes
      </h2>
      <input
        type="text"
        value={search}
        onChange={handleSearchChange}
        placeholder="Pesquisar por fornecedor ou SKU"
        className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <ul className="space-y-4">
        {filteredPedidos.map((pedido) => (
          <li
            key={pedido.id}
            className="p-4 bg-gray-100 dark:bg-gray-700 rounded-md shadow-sm"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Pedido #{pedido.id} - {pedido.fornecedor.nome}
              </h3>
              <div className="space-x-2">
                <button
                  onClick={() => handleEdit(pedido)}
                  className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(pedido.id)}
                  className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  Deletar
                </button>
              </div>
            </div>
            <p className="text-gray-700 dark:text-gray-300">
              Comentários: {pedido.comentarios}
            </p>
            {pedido.dataPrevista && (
              <p className="text-gray-700 dark:text-gray-300">
                Data Prevista:{" "}
                {format(new Date(pedido.dataPrevista), "dd/MM/yyyy", {
                  locale: ptBR,
                })}
              </p>
            )}
            <p className="text-gray-700 dark:text-gray-300">
              Valor Total: R$ {calcularValorTotalPedido(pedido).toFixed(2)}
            </p>
          </li>
        ))}
      </ul>
      {editPedido && (
        <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-md shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Editar Pedido #{editPedido.id}
          </h3>
          <textarea
            value={editPedido.comentarios}
            onChange={(e) =>
              setEditPedido({ ...editPedido, comentarios: e.target.value })
            }
            className="mt-2 w-full p-2 border border-gray-300 rounded-md dark:bg-gray-600 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
          />
          <select
            value={armazemId || ""}
            onChange={(e) => setArmazemId(Number(e.target.value) || null)}
            className="mt-2 w-full p-2 border border-gray-300 rounded-md dark:bg-gray-600 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Selecione um Armazém</option>
            {armazens.map((armazem) => (
              <option key={armazem.id} value={armazem.id}>
                {armazem.nome}
              </option>
            ))}
          </select>
          {editPedido.produtos.map((produto) => (
            <div key={produto.produtoId} className="mt-4">
              <p className="text-gray-900 dark:text-gray-100">
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
                  className="p-2 border border-gray-300 rounded-md dark:bg-gray-600 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="p-2 border border-gray-300 rounded-md dark:bg-gray-600 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Custo"
                />
              </div>
            </div>
          ))}
          <div className="mt-4 flex space-x-2">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              Salvar
            </button>
            <button
              onClick={() => handleConfirm(editPedido.id)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Confirmar
            </button>
          </div>
        </div>
      )}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Total: R$ {calcularValorTotal().toFixed(2)}
        </h3>
      </div>
    </div>
  );
};

export default PedidosPendentes;
