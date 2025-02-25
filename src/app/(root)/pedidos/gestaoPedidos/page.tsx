"use client";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useLayout } from "@/app/context/LayoutContext";

// Tipos compartilhados
interface Fornecedor {
  id: number;
  nome: string;
}

interface Produto {
  id: number;
  nome: string;
  sku: string;
  multiplicador?: number;
}

interface ProdutoFornecedor {
  produtoId: number;
  fornecedorId: number;
  preco: number;
  multiplicador: number;
  codigoNF: string;
  produto: Produto;
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
  armazemId?: number;
  dataConclusao?: string;
}

interface Armazem {
  id: number;
  nome: string;
}

// Componente Principal
const GestaoPedidos = () => {
  const { isSidebarCollapsed, isDarkMode } = useLayout();
  const [activeTab, setActiveTab] = useState<
    "novo" | "pendentes" | "concluidos"
  >("novo");

  return (
    <div className="flex flex-col w-full min-h-screen">
      <div className="bg-gray-50 dark:bg-gray-900 flex-1 p-6 md:p-9">
        <h1 className="text-2xl md:text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100">
          Gestão de Pedidos
        </h1>

        <div className="flex flex-col sm:flex-row sm:space-x-4 mb-6 border-b border-gray-200 dark:border-gray-700">
          {[
            { id: "novo", label: "Novo Pedido" },
            { id: "pendentes", label: "Pendentes" },
            { id: "concluidos", label: "Concluídos" },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`relative px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                activeTab === tab.id
                  ? "text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-600 dark:bg-blue-400 transition-all" />
              )}
            </button>
          ))}
        </div>

        {/* Conteúdo das abas */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transition-all duration-300">
          {activeTab === "novo" && <NovoPedido />}
          {activeTab === "pendentes" && <PedidosPendentes />}
          {activeTab === "concluidos" && <PedidosConcluidos />}
        </div>
      </div>
    </div>
  );
};

// Componente Novo Pedido
const NovoPedido = () => {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [produtoFornecedores, setProdutoFornecedores] = useState<
    ProdutoFornecedor[]
  >([]);
  const [fornecedorId, setFornecedorId] = useState<number | null>(null);
  const [novoProduto, setNovoProduto] = useState({
    produtoId: "",
    quantidade: "",
    custo: "",
    sku: "",
    codigoNF: "",
    multiplicador: "",
  });
  const [produtosPedido, setProdutosPedido] = useState<
    {
      produtoId: string;
      quantidade: string;
      custo: string;
      sku: string;
      codigoNF: string;
      multiplicador: string;
    }[]
  >([]);
  const [comentarios, setComentarios] = useState("");
  const [dataPrevista, setDataPrevista] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  useEffect(() => {
    const fetchFornecedores = async () => {
      try {
        const response = await fetch("/api/fornecedores");
        const data = await response.json();
        if (Array.isArray(data)) setFornecedores(data);
      } catch (error) {
        console.error("Erro ao buscar fornecedores", error);
      }
    };
    fetchFornecedores();
  }, []);

  useEffect(() => {
    const fetchProdutoFornecedores = async () => {
      if (fornecedorId) {
        try {
          const response = await fetch(
            `/api/produto-fornecedor?fornecedorId=${fornecedorId}`
          );
          const data = await response.json();
          if (Array.isArray(data)) setProdutoFornecedores(data);
        } catch (error) {
          console.error("Erro ao buscar produtos do fornecedor", error);
        }
      }
    };
    fetchProdutoFornecedores();
  }, [fornecedorId]);

  const handleProdutoChange = (field: string, value: string) =>
    setNovoProduto({ ...novoProduto, [field]: value });

  const handleRemoveProduto = (index: number) => {
    const newProdutosPedido = [...produtosPedido];
    newProdutosPedido.splice(index, 1);
    setProdutosPedido(newProdutosPedido);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fornecedorId || produtosPedido.length === 0) {
      setMessage(
        !fornecedorId
          ? "Selecione um fornecedor"
          : "Adicione pelo menos um produto ao pedido"
      );
      setMessageType("error");
      return;
    }

    const pedido = {
      fornecedorId,
      produtos: produtosPedido.map((p) => ({
        produtoId: Number(p.produtoId),
        quantidade: Number(p.quantidade),
        custo: Number(p.custo),
      })),
      comentarios,
      dataPrevista: new Date(dataPrevista),
    };

    try {
      const response = await fetch("/api/pedidos-compra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pedido),
      });
      if (response.ok) {
        setMessage("Pedido criado com sucesso!");
        setMessageType("success");
        setFornecedorId(null);
        setProdutosPedido([]);
        setComentarios("");
        setDataPrevista("");
      } else {
        setMessage("Erro ao criar pedido");
        setMessageType("error");
      }
    } catch (error) {
      console.error("Erro ao criar pedido:", error);
      setMessage("Erro ao criar pedido");
      setMessageType("error");
    }
  };

  const handleProdutoSearch = (sku: string) => {
    const produtoFornecedor = produtoFornecedores.find(
      (pf) => pf.produto.sku === sku
    );
    if (produtoFornecedor) {
      setNovoProduto({
        ...novoProduto,
        sku: produtoFornecedor.produto.sku,
        produtoId: produtoFornecedor.produtoId.toString(),
        custo: produtoFornecedor.preco.toString(),
        codigoNF: produtoFornecedor.codigoNF,
        multiplicador: produtoFornecedor.multiplicador.toString(),
      });
    } else {
      setNovoProduto({ ...novoProduto, sku, produtoId: "" });
    }
  };

  const handleAddProduto = () => {
    if (
      !novoProduto.produtoId ||
      !novoProduto.quantidade ||
      !novoProduto.custo ||
      !novoProduto.sku
    ) {
      setMessage("Preencha todos os campos do produto");
      setMessageType("error");
      return;
    }
    setProdutosPedido([...produtosPedido, { ...novoProduto }]);
    setNovoProduto({
      produtoId: "",
      quantidade: "",
      custo: "",
      sku: "",
      codigoNF: "",
      multiplicador: "",
    });
  };

  const calcularValorTotal = () =>
    produtosPedido.reduce((total, produto) => {
      const quantidade = Number(produto.quantidade);
      const custo = Number(produto.custo);
      const multiplicador = Number(produto.multiplicador);
      return total + quantidade * custo * multiplicador;
    }, 0);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
        Criar Novo Pedido
      </h2>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Fornecedor
            </label>
            <select
              value={fornecedorId || ""}
              onChange={(e) => setFornecedorId(Number(e.target.value))}
              className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="" disabled>
                Selecione um fornecedor
              </option>
              {fornecedores.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Data Prevista
            </label>
            <input
              type="date"
              value={dataPrevista}
              onChange={(e) => setDataPrevista(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Comentários
            </label>
            <textarea
              value={comentarios}
              onChange={(e) => setComentarios(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
            Produtos
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 mb-4">
            <select
              value={novoProduto.sku}
              onChange={(e) => handleProdutoSearch(e.target.value)}
              className="col-span-2 p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="" disabled>
                Selecione um SKU
              </option>
              {produtoFornecedores.map((pf) => (
                <option key={pf.produtoId} value={pf.produto.sku}>
                  {pf.produto.sku}
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Quantidade"
              value={novoProduto.quantidade}
              onChange={(e) =>
                handleProdutoChange("quantidade", e.target.value)
              }
              className="p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Custo"
              value={novoProduto.custo}
              readOnly
              className="p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:text-gray-200"
            />
            <button
              type="button"
              onClick={handleAddProduto}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Adicionar
            </button>
          </div>
          <ul className="space-y-2">
            {produtosPedido.map((produto, index) => (
              <li
                key={index}
                className="flex justify-between items-center p-2 bg-gray-100 dark:bg-gray-700 rounded-md"
              >
                <span>{produto.sku}</span>
                <span>{produto.quantidade}</span>
                <span>R$ {produto.custo}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveProduto(index)}
                  className="px-2 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Valor Total: R$ {calcularValorTotal().toFixed(2)}
          </h3>
        </div>

        {message && (
          <div
            className={`mt-4 p-2 rounded-md ${
              messageType === "success"
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {message}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Criar Pedido
          </button>
        </div>
      </form>
    </div>
  );
};

// Componente Pedidos Pendentes
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
      try {
        const response = await fetch("/api/estoque/criarArmazem");
        const data = await response.json();
        setArmazens(data);
      } catch (error) {
        setError("Erro ao buscar armazéns");
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
    if (!pedidoParaConfirmar) return;

    try {
      const response = await fetch("/api/pedidos-compra", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pedidoId: id,
          armazemId,
          produtosRecebidos: pedidoParaConfirmar.produtos,
        }),
      });

      if (response.ok) {
        setPedidos(pedidos.filter((pedido) => pedido.id !== id));
        setFilteredPedidos(
          filteredPedidos.filter((pedido) => pedido.id !== id)
        );
      } else {
        setError("Erro ao confirmar pedido");
      }
    } catch (error) {
      setError("Erro ao confirmar pedido");
    }
  };

  const handleEdit = (pedido: Pedido) => {
    setEditPedido({ ...pedido });
    setArmazemId(null);
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pedidoId: editPedido.id,
          armazemId,
          produtosRecebidos,
          comentarios: editPedido.comentarios,
        }),
      });

      if (response.ok) {
        setPedidos(pedidos.filter((pedido) => pedido.id !== editPedido.id));
        setFilteredPedidos(
          filteredPedidos.filter((pedido) => pedido.id !== editPedido.id)
        );
        setEditPedido(null);
      } else {
        setError("Erro ao salvar alterações");
      }
    } catch (error) {
      setError("Erro ao salvar alterações");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch("/api/pedidos-compra", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedidoId: id }),
      });

      if (response.ok) {
        setPedidos(pedidos.filter((pedido) => pedido.id !== id));
        setFilteredPedidos(
          filteredPedidos.filter((pedido) => pedido.id !== id)
        );
      } else {
        setError("Erro ao deletar pedido");
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
    const updatedProdutos = editPedido.produtos.map((produto) =>
      produto.produtoId === produtoId ? { ...produto, [field]: value } : produto
    );
    setEditPedido({ ...editPedido, produtos: updatedProdutos });
  };

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

  if (loading)
    return <p className="text-gray-500 dark:text-gray-400">Carregando...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
        Pedidos Pendentes
      </h2>
      <input
        type="text"
        value={search}
        onChange={handleSearchChange}
        placeholder="Pesquisar por fornecedor ou SKU"
        className="w-full p-2 mb-6 border border-gray-300 rounded-md dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <div className="space-x-2">
                <button
                  onClick={() => handleEdit(pedido)}
                  className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(pedido.id)}
                  className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  Deletar
                </button>
              </div>
            </div>
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
              Valor Total: R$ {calcularValorTotalPedido(pedido).toFixed(2)}
            </p>
          </li>
        ))}
      </ul>
      {editPedido && (
        <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-md shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Editar Pedido #{editPedido.id}
          </h3>
          <textarea
            value={editPedido.comentarios}
            onChange={(e) =>
              setEditPedido({ ...editPedido, comentarios: e.target.value })
            }
            className="mt-2 w-full p-2 border border-gray-300 rounded-md dark:bg-gray-600 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
          />
          <select
            value={armazemId || ""}
            onChange={(e) => setArmazemId(Number(e.target.value))}
            className="mt-2 w-full p-2 border border-gray-300 rounded-md dark:bg-gray-600 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Selecione um Armazém</option>
            {armazens.map((armazem) => (
              <option key={armazem.id} value={armazem.id}>
                {armazem.nome}
              </option>
            ))}
          </select>
          {editPedido.produtos.map((produto) => (
            <div key={produto.produtoId} className="mt-4">
              <p className="text-gray-900 dark:text-gray-100">
                {produto.produto?.nome} (SKU: {produto.produto?.sku})
              </p>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <input
                  type="number"
                  value={produto.quantidade}
                  onChange={(e) =>
                    handleProdutoChange(
                      produto.produtoId,
                      "quantidade",
                      Number(e.target.value)
                    )
                  }
                  className="p-2 border border-gray-300 rounded-md dark:bg-gray-600 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Quantidade"
                />
                <input
                  type="number"
                  value={produto.custo}
                  onChange={(e) =>
                    handleProdutoChange(
                      produto.produtoId,
                      "custo",
                      Number(e.target.value)
                    )
                  }
                  className="p-2 border border-gray-300 rounded-md dark:bg-gray-600 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Custo"
                />
              </div>
            </div>
          ))}
          <div className="mt-4 flex space-x-2">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              Salvar
            </button>
            <button
              onClick={() => handleConfirm(editPedido.id)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Confirmar
            </button>
          </div>
        </div>
      )}
      <div className="mt-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Total: R$ {calcularValorTotal().toFixed(2)}
        </h3>
      </div>
    </div>
  );
};

// Componente Pedidos Concluídos
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

  if (loading)
    return <p className="text-gray-500 dark:text-gray-400">Carregando...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
        Pedidos Concluídos
      </h2>
      <input
        type="text"
        value={search}
        onChange={handleSearchChange}
        placeholder="Pesquisar por fornecedor ou ID do pedido"
        className="w-full p-2 mb-6 border border-gray-300 rounded-md dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
      <div className="mt-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Total: R$ {calcularValorTotal().toFixed(2)}
        </h3>
      </div>
    </div>
  );
};

export default GestaoPedidos;
