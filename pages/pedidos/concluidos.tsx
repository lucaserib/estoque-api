import { ptBR } from "date-fns/locale";
import React, { useEffect, useState } from "react";
import { format } from "date-fns";

interface Fornecedor {
  id: number;
  nome: string;
}

interface Produto {
  id: number;
  nome: string;
  sku: string;
  multiplicador: number;
}

interface PedidoProduto {
  produtoId: number;
  quantidade: number;
  custo: number;
  produto: Produto;
}

interface Pedido {
  id: number;
  fornecedor: Fornecedor;
  produtos: PedidoProduto[];
  comentarios: string;
  status: string;
  armazemId: number;
  dataConclusao: string; // Atualizado para dataConclusao
}

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

  const calcularValorTotalPedido = (pedido: Pedido) => {
    return pedido.produtos.reduce((subtotal, produto) => {
      const quantidade = produto.quantidade;
      const custo = produto.custo;
      const multiplicador = produto.produto?.multiplicador || 1;
      return subtotal + quantidade * custo * multiplicador;
    }, 0);
  };

  const calcularValorTotal = () => {
    return filteredPedidos.reduce((total, pedido) => {
      return total + calcularValorTotalPedido(pedido);
    }, 0);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
    const lowerCaseSearch = event.target.value.toLowerCase();
    setFilteredPedidos(
      pedidos.filter(
        (pedido) =>
          pedido.fornecedor.nome.toLowerCase().includes(lowerCaseSearch) ||
          pedido.id.toString().includes(lowerCaseSearch)
      )
    );
  };

  if (loading) {
    return <p className="text-center mt-10">Carregando...</p>;
  }

  if (error) {
    return <p className="text-center mt-10 text-red-500">{error}</p>;
  }

  return (
    <div className="max-w-6xl mx-auto mt-10 p-6 bg-white dark:bg-gray-900 rounded-md shadow-md">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100">
        Pedidos Concluídos
      </h1>

      {/* Barra de pesquisa */}
      <div className="mb-6 flex justify-between items-center">
        <input
          type="text"
          value={search}
          onChange={handleSearchChange}
          placeholder="Pesquisar por fornecedor ou ID do pedido"
          className="p-3 w-full md:w-1/2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
        />
      </div>

      <ul className="space-y-6">
        {filteredPedidos.length > 0 ? (
          filteredPedidos.map((pedido) => (
            <li
              key={pedido.id}
              className="p-5 bg-gray-100 dark:bg-gray-800 rounded-lg shadow-md"
            >
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Pedido #{pedido.id} - {pedido.fornecedor.nome}
                </h2>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Concluído em:{" "}
                  {format(new Date(pedido.dataConclusao), "dd/MM/yyyy", {
                    locale: ptBR,
                  })}
                </span>
              </div>
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                Comentários: {pedido.comentarios || "Nenhum comentário"}
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                Valor Total do Pedido:{" "}
                <span className="font-semibold text-green-500">
                  R$ {calcularValorTotalPedido(pedido).toFixed(2)}
                </span>
              </p>
              <ul className="mt-2 space-y-1">
                {pedido.produtos.map((produto) => (
                  <li
                    key={produto.produtoId}
                    className="flex justify-between text-gray-700 dark:text-gray-300"
                  >
                    <span>
                      {produto.produto.nome} (SKU: {produto.produto.sku}) -
                      Quantidade: {produto.quantidade}
                    </span>
                    <span>Custo: R$ {produto.custo.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))
        ) : (
          <p className="text-center text-gray-700 dark:text-gray-300">
            Nenhum pedido encontrado.
          </p>
        )}
      </ul>

      <div className="mt-10 p-6 bg-gray-200 dark:bg-gray-700 rounded-md shadow-md">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Valor Total dos Pedidos Concluídos:
        </h2>
        <p className="text-2xl font-semibold text-green-600 dark:text-green-400">
          R$ {calcularValorTotal().toFixed(2)}
        </p>
      </div>
    </div>
  );
};

export default PedidosConcluidos;
