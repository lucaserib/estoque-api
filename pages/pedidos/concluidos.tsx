import { useEffect, useState } from "react";

interface Fornecedor {
  id: number;
  nome: string;
}

interface Produto {
  id: number;
  nome: string;
  sku: string;
}

interface Pedido {
  id: number;
  fornecedor: Fornecedor;
  produtos: {
    produtoId: number;
    quantidade: number;
    custo: number;
    produto: Produto;
  }[];
  comentarios: string;
  status: string;
  armazemId: number; // Adicionando armazemId
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
            className="flex justify-between items-center p-4 bg-gray-100 dark:bg-gray-700 rounded-md shadow-sm"
          >
            <div>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Fornecedor: {pedido.fornecedor.nome}
              </p>
              <ul className="space-y-2 mt-2">
                {pedido.produtos.map((produto) => (
                  <li key={produto.produtoId}>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Produto: {produto.produto.nome} (SKU:{" "}
                      {produto.produto.sku}) - Quantidade: {produto.quantidade}{" "}
                      - Custo: R${produto.custo}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Comentários: {pedido.comentarios}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Armazém: {pedido.armazemId}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PedidosConcluidos;
