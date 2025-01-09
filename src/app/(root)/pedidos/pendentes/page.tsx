"use client";
import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  produto?: Produto;
}

interface Pedido {
  id: number;
  fornecedor: Fornecedor;
  produtos: PedidoProduto[];
  comentarios: string;
  status: string;
  dataPrevista?: string;
}

interface Armazem {
  id: number;
  nome: string;
}

const PedidosPendentes = () => {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [filteredPedidos, setFilteredPedidos] = useState<Pedido[]>([]);
  const [armazens, setArmazens] = useState<Armazem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editPedido, setEditPedido] = useState<Pedido | null>(null);
  const [armazemId, setArmazemId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchPedidos = async () => {
      try {
        const response = await fetch("/api/pedidos-compra");
        const data = await response.json();
        const pedidosPendentes = data.filter(
          (pedido: Pedido) => pedido.status === "pendente"
        );
        setPedidos(pedidosPendentes);
        setFilteredPedidos(pedidosPendentes);
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

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
    const lowerCaseSearch = event.target.value.toLowerCase();
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
    setEditPedido({ ...pedido });
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
          comentarios: editPedido.comentarios,
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

  const handleComentariosChange = (comentarios: string) => {
    if (!editPedido) return;
    setEditPedido({ ...editPedido, comentarios });
  };

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

      {/* Barra de pesquisa */}
      <div className="mb-6 flex justify-between items-center">
        <input
          type="text"
          value={search}
          onChange={handleSearchChange}
          placeholder="Pesquisar por fornecedor ou SKU do produto"
          className="p-3 w-full md:w-1/2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
        />
      </div>

      <ul className="space-y-4">
        {filteredPedidos.map((pedido) => (
          <li
            key={pedido.id}
            className="p-4 bg-gray-100 dark:bg-gray-800 rounded-md shadow-md"
          >
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Pedido #{pedido.id} - {pedido.fornecedor.nome}
            </h2>
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
              Valor Total do Pedido: R${" "}
              {calcularValorTotalPedido(pedido).toFixed(2)}
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
              htmlFor="comentarios"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Comentários
            </label>
            <textarea
              id="comentarios"
              value={editPedido.comentarios}
              onChange={(e) => handleComentariosChange(e.target.value)}
              className="mt-1 block w-full px-3 py-2 text-base border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              rows={3}
            />
          </div>
          <div className="mb-4">
            <label
              htmlFor="armazemId"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Armazém
            </label>
            <select
              id="armazemId"
              value={armazemId || ""}
              onChange={(e) => setArmazemId(Number(e.target.value))}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Selecione um Armazém</option>
              {armazens.map((armazem) => (
                <option key={armazem.id} value={armazem.id}>
                  {armazem.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Produtos
            </h3>
            {editPedido.produtos.map((produto) => (
              <div
                key={produto.produtoId}
                className="flex items-center mb-4 space-x-4"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {produto.produto?.nome} (SKU: {produto.produto?.sku})
                  </p>
                  <label
                    htmlFor={`quantidade-${produto.produtoId}`}
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Quantidade
                  </label>
                  <input
                    type="number"
                    id={`quantidade-${produto.produtoId}`}
                    value={produto.quantidade}
                    onChange={(e) =>
                      handleProdutoChange(
                        produto.produtoId,
                        "quantidade",
                        Number(e.target.value)
                      )
                    }
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <label
                    htmlFor={`custo-${produto.produtoId}`}
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Custo
                  </label>
                  <input
                    type="number"
                    id={`custo-${produto.produtoId}`}
                    value={produto.custo}
                    onChange={(e) =>
                      handleProdutoChange(
                        produto.produtoId,
                        "custo",
                        Number(e.target.value)
                      )
                    }
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Salvar
          </button>
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Total dos Pedidos Pendentes: R$ {calcularValorTotal().toFixed(2)}
        </h2>
      </div>
    </div>
  );
};

export default PedidosPendentes;
