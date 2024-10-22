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
        console.log("Fornecedores recebidos:", data);
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
          console.log("Produtos do fornecedor recebidos:", data);
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
        produtoId: produtoFornecedor.produtoId.toString(), // Certifica-se que o ID é corretamente atribuído
        custo: produtoFornecedor.preco.toString(),
        codigoNF: produtoFornecedor.codigoNF,
        multiplicador: produtoFornecedor.multiplicador.toString(),
      });
    } else {
      setNovoProduto({
        ...novoProduto,
        sku: sku,
        produtoId: "", // Limpa o produtoId caso o SKU não seja encontrado
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

    // Adiciona o produto à lista
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
    console.log("Fornecedor selecionado:", fornecedorId);
    setFornecedorId(fornecedorId);
  };

  const handleSkuChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sku = e.target.value;
    console.log("SKU selecionado:", sku);
    handleProdutoSearch(sku);
  };

  return (
    <div className="max-w-4xl mx-auto mt-10 p-6 bg-white dark:bg-gray-900 rounded-md shadow-md">
      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
        Novo Pedido
      </h1>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-gray-700 dark:text-gray-300">
            Fornecedor
          </label>
          <select
            value={fornecedorId || ""}
            onChange={handleFornecedorChange}
            className="mt-1 block w-full"
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
        <div className="mb-4">
          <label className="block text-gray-700 dark:text-gray-300">
            Comentários
          </label>
          <textarea
            value={comentarios}
            onChange={(e) => setComentarios(e.target.value)}
            className="mt-1 block w-full"
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700 dark:text-gray-300">
            Produtos
          </label>
          <div className="flex mb-2">
            <select
              value={novoProduto.sku}
              onChange={handleSkuChange}
              className="mt-1 block w-full"
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
              className="mt-1 block w-full"
            />
            <input
              type="text"
              placeholder="Custo"
              value={novoProduto.custo}
              onChange={(e) => handleProdutoChange("custo", e.target.value)}
              className="mt-1 block w-full"
              readOnly
            />
            <input
              type="text"
              placeholder="Código NF"
              value={novoProduto.codigoNF}
              onChange={(e) => handleProdutoChange("codigoNF", e.target.value)}
              className="mt-1 block w-full"
              readOnly
            />
            <input
              type="text"
              placeholder="Multiplicador"
              value={novoProduto.multiplicador}
              onChange={(e) =>
                handleProdutoChange("multiplicador", e.target.value)
              }
              className="mt-1 block w-full"
              readOnly
            />
            <button
              type="button"
              onClick={handleAddProduto}
              className="ml-2 bg-blue-500 text-white px-4 py-2 rounded"
            >
              Adicionar
            </button>
          </div>
          <ul>
            {produtosPedido.map((produto, index) => (
              <li key={index} className="flex justify-between items-center">
                <span>{produto.sku}</span>
                <span>{produto.quantidade}</span>
                <span>{produto.custo}</span>
                <span>{produto.codigoNF}</span>
                <span>{produto.multiplicador}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveProduto(index)}
                  className="ml-2 bg-red-500 text-white px-4 py-2 rounded"
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        </div>
        {message && (
          <div
            className={`mb-4 p-4 rounded ${
              messageType === "success" ? "bg-green-500" : "bg-red-500"
            } text-white`}
          >
            {message}
          </div>
        )}
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Criar Pedido
        </button>
      </form>
    </div>
  );
};

export default NovoPedido;
