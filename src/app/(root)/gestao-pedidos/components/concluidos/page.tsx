"use client";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Pedido } from "../../types";
import { useFetch } from "../../../../hooks/useFetch";
import { centsToBRL, formatBRL } from "@/utils/currency";

const PedidosConcluidos = () => {
  const {
    data: pedidos,
    loading,
    error,
  } = useFetch<Pedido>("/api/pedidos-compra", (data) =>
    data.filter((pedido) => pedido.status === "confirmado")
  );
  const [filteredPedidos, setFilteredPedidos] = useState<Pedido[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setFilteredPedidos(pedidos);
  }, [pedidos]);

  const calcularValorTotalPedido = (pedido: Pedido) =>
    pedido.produtos.reduce((subtotal, produto) => {
      const quantidade = produto.quantidade;
      const custo = produto.custo / 100;
      const multiplicador =
        produto.multiplicador || produto.produto?.multiplicador || 1; // Prioriza o multiplicador do pedidoProduto
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
    const lowerCaseSearch = value.toLowerCase();
    setFilteredPedidos(
      pedidos.filter(
        (pedido) =>
          pedido.fornecedor.nome.toLowerCase().includes(lowerCaseSearch) ||
          pedido.id.toString().includes(lowerCaseSearch)
      )
    );
  };

  if (loading)
    return (
      <p className="text-gray-500 dark:text-gray-400 text-center">
        Carregando...
      </p>
    );
  if (error) return <p className="text-red-500 text-center">{error}</p>;

  return (
    <div className="bg-white dark:bg-gray-900 shadow-xl rounded-xl p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-100 tracking-tight">
        Pedidos Concluídos
      </h2>
      <input
        type="text"
        value={search}
        onChange={handleSearchChange}
        placeholder="Pesquisar por fornecedor ou ID do pedido"
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
              <span className="font-medium">Valor Total:</span>
              {formatBRL(calcularValorTotalPedido(pedido) * 100)}
            </p>
            <ul className="mt-3 space-y-2">
              {pedido.produtos.map((produto) => (
                <li
                  key={produto.produtoId}
                  className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded-md"
                >
                  <span className="font-medium">{produto.produto?.sku}</span> -{" "}
                  {produto.produto?.nome}
                  <br />
                  Qtd: {produto.quantidade} | Custo:
                  {formatBRL(produto.custo)} | Mult:{" "}
                  {produto.multiplicador || produto.produto?.multiplicador || 1}{" "}
                  | Total:
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
      <div className="mt-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Total Geral: {formatBRL(calcularValorTotal() * 100)}
        </h3>
      </div>
    </div>
  );
};

export default PedidosConcluidos;
