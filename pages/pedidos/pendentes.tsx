import { useEffect, useState } from "react";
import { FaCheck, FaEdit } from "react-icons/fa";

interface Fornecedor {
  id: number;
  nome: string;
}

interface Produto {
  id: number;
  nome: string;
  sku: string;
}

interface PedidoProduto {
  produtoId: number;
  quantidade: number;
  custo: number;
  produto?: Produto; // Produto pode ser opcional
}

interface Pedido {
  id: number;
  fornecedor: Fornecedor;
  produtos: PedidoProduto[];
  comentarios: string;
  status: string;
}

const PedidosPendentes = () => {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editPedido, setEditPedido] = useState<Pedido | null>(null);
  const [armazemId, setArmazemId] = useState<number | null>(null);

  useEffect(() => {
    const fetchPedidos = async () => {
      try {
        const response = await fetch("/api/pedidos-compra");
        const data = await response.json();
        setPedidos(
          data.filter((pedido: Pedido) => pedido.status === "pendente")
        );
      } catch (error) {
        setError("Erro ao buscar pedidos");
      } finally {
        setLoading(false);
      }
    };

    fetchPedidos();
  }, []);

  const handleConfirm = async (id: number) => {
    if (!armazemId) {
      setError("Armazém é obrigatório para confirmar o pedido");
      return;
    }

    const pedidoParaConfirmar = pedidos.find((pedido) => pedido.id === id);

    if (!pedidoParaConfirmar) {
      setError("Pedido não encontrado");
      return;
    }

    try {
      console.log("Enviando dados para confirmação:", {
        pedidoId: id,
        armazemId,
        produtosRecebidos: pedidoParaConfirmar.produtos,
      });

      const response = await fetch(`/api/pedidos-compra`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pedidoId: id,
          armazemId,
          produtosRecebidos: pedidoParaConfirmar.produtos,
        }),
      });

      if (response.ok) {
        setPedidos(pedidos.filter((pedido) => pedido.id !== id));
        setEditPedido(null);
        setArmazemId(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Erro ao confirmar pedido");
      }
    } catch (error) {
      setError("Erro ao confirmar pedido");
    }
  };

  const handleEdit = (pedido: Pedido) => {
    setEditPedido(pedido);
  };

  const handleSave = async () => {
    if (!editPedido) return;

    try {
      console.log("Enviando dados para salvar:", {
        pedidoId: editPedido.id,
        armazemId,
        produtosRecebidos: editPedido.produtos,
      });

      const response = await fetch(`/api/pedidos-compra`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pedidoId: editPedido.id,
          armazemId,
          produtosRecebidos: editPedido.produtos,
        }),
      });

      if (response.ok) {
        setPedidos(
          pedidos.map((pedido) =>
            pedido.id === editPedido.id ? editPedido : pedido
          )
        );
        setEditPedido(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Erro ao salvar alterações");
      }
    } catch (error) {
      setError("Erro ao salvar alterações");
    }
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
        Pedidos Pendentes
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
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Comentários: {pedido.comentarios}
              </p>
              <ul className="mt-2">
                {pedido.produtos.map((produto, index) => (
                  <li key={index}>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Produto: {produto.produto?.nome || "Desconhecido"} (SKU:{" "}
                      {produto.produto?.sku || "Desconhecido"}) - Quantidade:{" "}
                      {produto.quantidade} - Custo: R${produto.custo}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => handleConfirm(pedido.id)}
                className="text-green-500 hover:text-green-700"
              >
                <FaCheck />
              </button>
              <button
                onClick={() => handleEdit(pedido)}
                className="text-blue-500 hover:text-blue-700"
              >
                <FaEdit />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {editPedido && (
        <div className="mt-10 p-6 bg-white dark:bg-gray-900 rounded-md shadow-md">
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
            Editar Pedido
          </h2>
          <ul className="space-y-4">
            {editPedido.produtos.map((produto, index) => (
              <li key={index} className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Produto: {produto.produto?.nome || "Desconhecido"} (SKU:{" "}
                    {produto.produto?.sku || "Desconhecido"})
                  </p>
                  <input
                    type="number"
                    value={produto.quantidade}
                    onChange={(e) =>
                      setEditPedido({
                        ...editPedido,
                        produtos: editPedido.produtos.map((p, i) =>
                          i === index
                            ? { ...p, quantidade: Number(e.target.value) }
                            : p
                        ),
                      })
                    }
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                  <input
                    type="number"
                    value={produto.custo}
                    onChange={(e) =>
                      setEditPedido({
                        ...editPedido,
                        produtos: editPedido.produtos.map((p, i) =>
                          i === index
                            ? { ...p, custo: Number(e.target.value) }
                            : p
                        ),
                      })
                    }
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </li>
            ))}
          </ul>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Armazém
            </label>
            <input
              type="number"
              value={armazemId || ""}
              onChange={(e) => setArmazemId(Number(e.target.value))}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              required
            />
          </div>
          <button
            onClick={handleSave}
            className="mt-4 w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          >
            Salvar Alterações
          </button>
        </div>
      )}
    </div>
  );
};

export default PedidosPendentes;
