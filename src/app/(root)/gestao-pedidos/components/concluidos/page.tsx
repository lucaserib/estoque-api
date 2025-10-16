"use client";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Pedido } from "../../types";
import { useFetch } from "../../../../hooks/useFetch";
import { formatBRL } from "@/utils/currency";

const PedidosConcluidos = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const {
    data: pedidos,
    loading,
    error,
    refetch,
  } = useFetch<Pedido[]>(
    "/api/pedidos-compra",
    (data: unknown) => {
      return (data as Pedido[]).filter(
        (pedido) => pedido.status === "confirmado"
      );
    },
    [refreshTrigger]
  );

  const [filteredPedidos, setFilteredPedidos] = useState<Pedido[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (pedidos) {
      console.log("Pedidos confirmados recebidos:", pedidos.length);
      setFilteredPedidos(pedidos);
    }
  }, [pedidos]);

  const refreshData = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const calcularValorTotalPedido = (pedido: Pedido) =>
    pedido.produtos.reduce((subtotal, produto) => {
      const quantidade = produto.quantidade;
      const custo = produto.custo;
      const multiplicador =
        produto.multiplicador || produto.produto?.multiplicador || 1;
      return subtotal + quantidade * custo * multiplicador;
    }, 0);

  const calcularValorTotal = () =>
    filteredPedidos.reduce(
      (total, pedido) => total + calcularValorTotalPedido(pedido),
      0
    );

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearch(value);

    if (!pedidos) return;

    const lowerCaseSearch = value.toLowerCase();
    setFilteredPedidos(
      pedidos.filter(
        (pedido) =>
          pedido.fornecedor.nome.toLowerCase().includes(lowerCaseSearch) ||
          pedido.id.toString().includes(lowerCaseSearch) ||
          pedido.produtos.some(
            (p) =>
              p.produto?.nome.toLowerCase().includes(lowerCaseSearch) ||
              p.produto?.sku.toLowerCase().includes(lowerCaseSearch)
          )
      )
    );
  };

  if (loading)
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
        <p className="ml-2 text-gray-500 dark:text-gray-400">
          Carregando pedidos concluídos...
        </p>
      </div>
    );

  if (error)
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-md">
        <p className="text-red-500 text-center">{error}</p>
        <button
          onClick={refreshData}
          className="mt-2 mx-auto block px-4 py-2 bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200 rounded-md hover:bg-red-200 dark:hover:bg-red-700"
        >
          Tentar novamente
        </button>
      </div>
    );

  if (!pedidos || pedidos.length === 0)
    return (
      <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 p-8 rounded-xl text-center">
        <h3 className="text-xl font-semibold mb-2 text-gray-700 dark:text-gray-300">
          Nenhum pedido concluído
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          Os pedidos confirmados aparecerão aqui.
        </p>
        <button
          onClick={refreshData}
          className="px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-md hover:bg-indigo-200 dark:hover:bg-indigo-800/50"
        >
          Atualizar
        </button>
      </div>
    );

  return (
    <div className="bg-white dark:bg-gray-900 shadow-xl rounded-xl p-6">
      <div className="flex justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 tracking-tight">
          Pedidos Concluídos ({filteredPedidos.length})
        </h2>
        <button
          onClick={refreshData}
          className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-md hover:bg-indigo-200 dark:hover:bg-indigo-800/50 text-sm"
        >
          Atualizar
        </button>
      </div>

      <input
        type="text"
        value={search}
        onChange={handleSearchChange}
        placeholder="Pesquisar por fornecedor, ID ou produto"
        className="w-full p-3 mb-6 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />

      {filteredPedidos.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 p-6 rounded-lg text-center">
          <p className="text-gray-500 dark:text-gray-400">
            Nenhum pedido encontrado com os critérios de pesquisa.
          </p>
        </div>
      ) : (
        <ul className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filteredPedidos.map((pedido) => (
            <li
              key={pedido.id}
              className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200"
            >
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Pedido #{pedido.id}
                </h3>
                {pedido.dataConclusao && (
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {format(new Date(pedido.dataConclusao), "dd/MM/yyyy", {
                      locale: ptBR,
                    })}
                  </span>
                )}
              </div>
              <p className="text-gray-700 dark:text-gray-300">
                <span className="font-medium">Fornecedor:</span>{" "}
                {pedido.fornecedor.nome}
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                <span className="font-medium">Comentários:</span>{" "}
                {pedido.comentarios || "Nenhum"}
              </p>
              <p className="text-gray-700 dark:text-gray-300 mt-2">
                <span className="font-medium">Valor Total:</span>{" "}
                {formatBRL(calcularValorTotalPedido(pedido))}
              </p>
              <ul className="mt-3 space-y-2">
                {pedido.produtos.map((produto) => (
                  <li
                    key={produto.produtoId}
                    className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded-md"
                  >
                    <span className="font-medium">{produto.produto?.sku}</span>{" "}
                    - {produto.produto?.nome}
                    <br />
                    Qtd: {produto.quantidade} | Custo:{" "}
                    {formatBRL(produto.custo)} | Mult:{" "}
                    {produto.multiplicador ||
                      produto.produto?.multiplicador ||
                      1}{" "}
                    | Total:{" "}
                    {formatBRL(
                      produto.quantidade *
                        produto.custo *
                        (produto.multiplicador ||
                          produto.produto?.multiplicador ||
                          1)
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Total Geral: {formatBRL(calcularValorTotal())}
        </h3>
      </div>
    </div>
  );
};

export default PedidosConcluidos;
