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

interface ProdutoFornecedor {
  produtoId: number;
  fornecedorId: number;
  preco: number;
  multiplicador: number;
  codigoNF: string;
  produto: Produto;
}

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
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  useEffect(() => {
    const fetchFornecedores = async () => {
      try {
        const response = await fetch("/api/fornecedores");
        const data = await response.json();
        if (Array.isArray(data)) {
          setFornecedores(data);
        } else {
          console.error("Dados inválidos recebidos da API");
        }
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
          if (Array.isArray(data)) {
            setProdutoFornecedores(data);
          } else {
            console.error("Dados inválidos recebidos da API");
          }
        } catch (error) {
          console.error("Erro ao buscar produtos do fornecedor", error);
        }
      }
    };

    fetchProdutoFornecedores();
  }, [fornecedorId]);

  const handleProdutoChange = (field: string, value: string) => {
    setNovoProduto({ ...novoProduto, [field]: value });
  };

  const handleRemoveProduto = (index: number) => {
    const newProdutosPedido = [...produtosPedido];
    newProdutosPedido.splice(index, 1);
    setProdutosPedido(newProdutosPedido);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fornecedorId) {
      setMessage("Selecione um fornecedor");
      setMessageType("error");
      return;
    }

    if (produtosPedido.length === 0) {
      setMessage("Adicione pelo menos um produto ao pedido");
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
    };

    try {
      const response = await fetch("/api/pedidos-compra", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(pedido),
      });

      if (response.ok) {
        setMessage("Pedido criado com sucesso!");
        setMessageType("success");
        setFornecedorId(null);
        setProdutosPedido([]);
        setComentarios("");
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
      setNovoProduto({
        ...novoProduto,
        sku: sku,
        produtoId: "",
      });
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

  const handleFornecedorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const fornecedorId = Number(e.target.value);
    setFornecedorId(fornecedorId);
  };

  const handleSkuChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sku = e.target.value;
    handleProdutoSearch(sku);
  };

  return (
    <div className="max-w-4xl mx-auto mt-10 p-6 bg-white dark:bg-gray-900 rounded-md shadow-lg">
      <h1 className="text-3xl font-semibold mb-6 text-gray-900 dark:text-gray-100">
        Criar Novo Pedido
      </h1>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Fornecedor
            </label>
            <select
              value={fornecedorId || ""}
              onChange={handleFornecedorChange}
              className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:text-gray-200"
            >
              <option value="" disabled>
                Selecione um fornecedor
              </option>
              {fornecedores.map((fornecedor) => (
                <option key={fornecedor.id} value={fornecedor.id}>
                  {fornecedor.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Comentários
            </label>
            <textarea
              value={comentarios}
              onChange={(e) => setComentarios(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:text-gray-200"
            />
          </div>
        </div>

        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Produtos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 items-center mb-4">
            <select
              value={novoProduto.sku}
              onChange={handleSkuChange}
              className="col-span-1 sm:col-span-2 p-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:text-gray-200"
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
              type="text"
              placeholder="Quantidade"
              value={novoProduto.quantidade}
              onChange={(e) =>
                handleProdutoChange("quantidade", e.target.value)
              }
              className="col-span-1 p-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:text-gray-200"
            />
            <input
              type="text"
              placeholder="Custo"
              value={novoProduto.custo}
              onChange={(e) => handleProdutoChange("custo", e.target.value)}
              className="col-span-1 p-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:text-gray-200"
              readOnly
            />
            <input
              type="text"
              placeholder="Código NF"
              value={novoProduto.codigoNF}
              onChange={(e) => handleProdutoChange("codigoNF", e.target.value)}
              className="col-span-1 p-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:text-gray-200"
            />
            <button
              type="button"
              onClick={handleAddProduto}
              className="col-span-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Adicionar
            </button>
          </div>

          {produtosPedido.length > 0 && (
            <div className="mt-4">
              <table className="min-w-full bg-white dark:bg-gray-800">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-900 dark:text-gray-100">
                      SKU
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-900 dark:text-gray-100">
                      Quantidade
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-900 dark:text-gray-100">
                      Custo
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-900 dark:text-gray-100">
                      Código NF
                    </th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {produtosPedido.map((produto, index) => (
                    <tr key={index} className="border-t">
                      <td className="px-4 py-2">{produto.sku}</td>
                      <td className="px-4 py-2">{produto.quantidade}</td>
                      <td className="px-4 py-2">{produto.custo}</td>
                      <td className="px-4 py-2">{produto.codigoNF}</td>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => handleRemoveProduto(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {message && (
          <div
            className={`mt-6 p-4 rounded-md text-white ${
              messageType === "success" ? "bg-green-500" : "bg-red-500"
            }`}
          >
            {message}
          </div>
        )}

        <div className="mt-6">
          <button
            type="submit"
            className="w-full py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Criar Pedido
          </button>
        </div>
      </form>
    </div>
  );
};

export default NovoPedido;
