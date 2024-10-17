import React, { useEffect, useState } from "react";

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

interface Armazem {
  id: number;
  nome: string;
}

const PedidosPendentes = () => {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [armazens, setArmazens] = useState<Armazem[]>([]);
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

    const fetchArmazens = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/estoque/criarArmazem");
        const data = await response.json();
        setArmazens(data);
      } catch (error) {
        setError("Erro ao buscar armazéns");
      } finally {
        setLoading(false);
      }
    };

    fetchPedidos();
    fetchArmazens();
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
      const response = await fetch("/api/pedidos-compra", {
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
    setArmazemId(null); // Resetar armazemId ao editar
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pedidoId: editPedido.id,
          armazemId,
          produtosRecebidos,
        }),
      });

      if (response.ok) {
        setPedidos(pedidos.filter((pedido) => pedido.id !== editPedido.id));
        setEditPedido(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Erro ao salvar alterações");
      }
    } catch (error) {
      setError("Erro ao salvar alterações");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch("/api/pedidos-compra", {
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

  const handleProdutoChange = (
    produtoId: number,
    field: string,
    value: number
  ) => {
    if (!editPedido) return;

    const updatedProdutos = editPedido.produtos.map((produto) => {
      if (produto.produtoId === produtoId) {
        return { ...produto, [field]: value };
      }
      return produto;
    });

    setEditPedido({ ...editPedido, produtos: updatedProdutos });
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
            className="p-4 bg-gray-100 dark:bg-gray-800 rounded-md shadow-md"
          >
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Pedido #{pedido.id} - {pedido.fornecedor.nome}
            </h2>
            <p className="text-gray-700 dark:text-gray-300">
              {pedido.comentarios}
            </p>
            <button
              onClick={() => handleEdit(pedido)}
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Editar
            </button>
            <button
              onClick={() => handleDelete(pedido.id)}
              className="mt-2 ml-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Deletar
            </button>
          </li>
        ))}
      </ul>

      {editPedido && (
        <div className="mt-10 p-6 bg-white dark:bg-gray-900 rounded-md shadow-md">
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
            Editar Pedido #{editPedido.id}
          </h2>
          <div className="mb-4">
            <label
              htmlFor="armazem"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Selecione o Armazém
            </label>
            <select
              id="armazem"
              name="armazem"
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              onChange={(e) => setArmazemId(Number(e.target.value))}
            >
              <option value="">Selecione um armazém</option>
              {armazens.map((armazem) => (
                <option key={armazem.id} value={armazem.id}>
                  {armazem.nome}
                </option>
              ))}
            </select>
          </div>
          {editPedido.produtos.map((produto) => (
            <div key={produto.produtoId} className="mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {produto.produto?.nome || "Produto"} (SKU:{" "}
                {produto.produto?.sku || "N/A"})
              </h3>
              <label
                htmlFor={`quantidade-${produto.produtoId}`}
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Quantidade
              </label>
              <input
                id={`quantidade-${produto.produtoId}`}
                type="number"
                value={produto.quantidade}
                onChange={(e) =>
                  handleProdutoChange(
                    produto.produtoId,
                    "quantidade",
                    Number(e.target.value)
                  )
                }
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              />
              <label
                htmlFor={`custo-${produto.produtoId}`}
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mt-2"
              >
                Custo
              </label>
              <input
                id={`custo-${produto.produtoId}`}
                type="number"
                value={produto.custo}
                onChange={(e) =>
                  handleProdutoChange(
                    produto.produtoId,
                    "custo",
                    Number(e.target.value)
                  )
                }
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              />
            </div>
          ))}

          <button
            onClick={handleSave}
            className="mt-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Salvar Alterações
          </button>
        </div>
      )}
    </div>
  );
};

export default PedidosPendentes;
