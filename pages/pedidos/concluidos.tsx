import { useEffect, useState } from "react";
import { FaTrash } from "react-icons/fa";

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
  armazemId: number;
  data: string;
}

const PedidosConcluidos = () => {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dataInicio, setDataInicio] = useState<string | null>(null);
  const [dataFim, setDataFim] = useState<string | null>(null);

  useEffect(() => {
    const fetchPedidos = async () => {
      try {
        // Buscando pedidos já confirmados com as quantidades editadas
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

  const handleDelete = async (id: number) => {
    if (!window.confirm("Tem certeza que deseja excluir este pedido?")) {
      return;
    }

    try {
      const response = await fetch(`/api/pedidos-compra`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pedidoId: id }),
      });

      if (response.ok) {
        setPedidos(pedidos.filter((pedido) => pedido.id !== id));
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Erro ao deletar pedido");
      }
    } catch (error) {
      setError("Erro ao deletar pedido");
    }
  };

  // Filtros de data
  const handleDataInicioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDataInicio(e.target.value);
  };

  const handleDataFimChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDataFim(e.target.value);
  };

  // Filtrando pedidos dentro do intervalo de datas
  const pedidosFiltrados = pedidos.filter((pedido) => {
    const pedidoData = new Date(pedido.data);

    if (dataInicio && dataFim) {
      const inicio = new Date(dataInicio);
      const fim = new Date(dataFim);
      return pedidoData >= inicio && pedidoData <= fim;
    } else if (dataInicio) {
      const inicio = new Date(dataInicio);
      return pedidoData >= inicio;
    } else if (dataFim) {
      const fim = new Date(dataFim);
      return pedidoData <= fim;
    }

    return true; // Retorna todos os pedidos se não houver filtros de data
  });

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

      {/* Filtro por intervalo de datas */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Data de Início:
          </label>
          <input
            type="date"
            onChange={handleDataInicioChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Data Final:
          </label>
          <input
            type="date"
            onChange={handleDataFimChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>
      </div>

      <ul className="space-y-4">
        {pedidosFiltrados.map((pedido) => (
          <li
            key={pedido.id}
            className="flex justify-between items-center p-4 bg-gray-100 dark:bg-gray-700 rounded-md shadow-sm"
          >
            <div>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Pedido #{pedido.id} - Fornecedor: {pedido.fornecedor.nome}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Data do Pedido: {new Date(pedido.data).toLocaleDateString()}
              </p>

              {/* Exibindo os produtos com as quantidades atualizadas */}
              <details className="mt-2">
                <summary className="cursor-pointer text-gray-600 dark:text-gray-400">
                  Ver produtos ({pedido.produtos.length})
                </summary>
                <ul className="space-y-2 mt-2">
                  {pedido.produtos.map((produto) => (
                    <li key={produto.produtoId}>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Produto: {produto.produto.nome} (SKU:{" "}
                        {produto.produto.sku}) - Quantidade:{" "}
                        {produto.quantidade} - Custo: R${produto.custo}
                      </p>
                    </li>
                  ))}
                </ul>
              </details>

              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Comentários: {pedido.comentarios}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Armazém: {pedido.armazemId}
              </p>
            </div>
            <button
              onClick={() => handleDelete(pedido.id)}
              className="text-red-500 hover:text-red-700"
            >
              <FaTrash />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PedidosConcluidos;
