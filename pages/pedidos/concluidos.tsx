import React, { useEffect, useState } from "react";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchPedidos = async () => {
      try {
        const response = await fetch("/api/pedidos-compra");
        const data = await response.json();
        setPedidos(
          data.filter((pedido: Pedido) => pedido.status === "confirmado")
        );
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
    return pedidos.reduce((total, pedido) => {
      return total + calcularValorTotalPedido(pedido);
    }, 0);
  };

  if (loading) {
    return <p className="text-center mt-10">Carregando...</p>;
  }

  if (error) {
    return <p className="text-center mt-10 text-red-500">{error}</p>;
  }

  return (
    <div className="max-w-4xl mx-auto mt-10 p-6 bg-white dark:bg-gray-900 rounded-md shadow-md">
      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
        Pedidos Concluídos
      </h1>
      <ul className="space-y-4">
        {pedidos.map((pedido) => (
          <li
            key={pedido.id}
            className="p-4 bg-gray-100 dark:bg-gray-800 rounded-md shadow-md"
          >
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Pedido #{pedido.id} - {pedido.fornecedor.nome}
            </h2>
            <p className="text-gray-700 dark:text-gray-300">
              {pedido.comentarios}
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              Data de Conclusão:{" "}
              {new Date(pedido.dataConclusao).toLocaleDateString()}
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              Valor Total do Pedido: R$
              {calcularValorTotalPedido(pedido).toFixed(2)}
            </p>
            <ul className="mt-2">
              {pedido.produtos.map((produto) => (
                <li
                  key={produto.produtoId}
                  className="text-gray-700 dark:text-gray-300"
                >
                  {produto.produto.nome} (SKU: {produto.produto.sku}) -
                  Quantidade: {produto.quantidade} - Custo: R$
                  {produto.custo.toFixed(2)}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <div className="mt-10 p-6 bg-white dark:bg-gray-900 rounded-md shadow-md">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
          Valor Total dos Pedidos Concluídos: R$
          {calcularValorTotal().toFixed(2)}
        </h2>
      </div>
    </div>
  );
};

export default PedidosConcluidos;
