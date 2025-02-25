// app/gestao-pedidos/components/PedidosConcluidos.tsx
"use client";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Pedido } from "../../types";

const PedidosConcluidos = () => {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [filteredPedidos, setFilteredPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchPedidos = async () => {
      try {
        const response = await fetch("/api/pedidos-compra");
        const data = await response.json();
        const pedidosConcluidos = data.filter(
          (pedido: Pedido) => pedido.status === "confirmado"
        );
        setPedidos(pedidosConcluidos);
        setFilteredPedidos(pedidosConcluidos);
      } catch (error) {
        setError("Erro ao buscar pedidos");
      } finally {
        setLoading(false);
      }
    };
    fetchPedidos();
  }, []);

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
    return <p className="text-gray-500 dark:text-gray-400">Carregando...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
        Pedidos Concluídos
      </h2>
      <input
        type="text"
        value={search}
        onChange={handleSearchChange}
        placeholder="Pesquisar por fornecedor ou ID do pedido"
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
              {pedido.dataConclusao && (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Concluído em:{" "}
                  {format(new Date(pedido.dataConclusao), "dd/MM/yyyy", {
                    locale: ptBR,
                  })}
                </span>
              )}
            </div>
            <p className="text-gray-700 dark:text-gray-300">
              Comentários: {pedido.comentarios || "Nenhum"}
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              Valor Total: R$ {calcularValorTotalPedido(pedido).toFixed(2)}
            </p>
            <ul className="mt-2 space-y-1">
              {pedido.produtos.map((produto) => (
                <li
                  key={produto.produtoId}
                  className="text-gray-600 dark:text-gray-400"
                >
                  {produto.produto?.nome} (SKU: {produto.produto?.sku}) -
                  Quantidade: {produto.quantidade} - Custo: R${" "}
                  {produto.custo.toFixed(2)}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Total: R$ {calcularValorTotal().toFixed(2)}
        </h3>
      </div>
    </div>
  );
};

export default PedidosConcluidos;
