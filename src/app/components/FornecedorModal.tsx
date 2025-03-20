import { useEffect, useState } from "react";

interface Fornecedor {
  id: string;
  nome: string;
}

interface ProdutoFornecedor {
  id: string;
  fornecedor: Fornecedor;
  preco: number;
  multiplicador: number;
  codigoNF: string;
}

interface Produto {
  id: string;
  nome: string;
  sku: string;
}

interface FornecedorModalProps {
  produto: Produto;
  onClose: () => void;
}

const FornecedorModal = ({ produto, onClose }: FornecedorModalProps) => {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [fornecedoresVinculados, setFornecedoresVinculados] = useState<
    ProdutoFornecedor[]
  >([]);
  const [fornecedorId, setFornecedorId] = useState<string | null>(null);
  const [preco, setPreco] = useState("");
  const [multiplicador, setMultiplicador] = useState("");
  const [codigoNF, setCodigoNF] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  const [editingId, setEditingId] = useState<string | null>(null);

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

    const fetchFornecedoresVinculados = async () => {
      try {
        const response = await fetch(
          `/api/produto-fornecedor?produtoId=${produto.id}`
        );
        const data = await response.json();
        if (Array.isArray(data)) {
          setFornecedoresVinculados(data);
        } else {
          console.error("Dados inválidos recebidos da API");
        }
      } catch (error) {
        console.error("Erro ao buscar fornecedores vinculados", error);
      }
    };

    fetchFornecedores();
    fetchFornecedoresVinculados();
  }, [produto.id]);

  const handleVincularFornecedor = async () => {
    if (!fornecedorId || !preco || !multiplicador || !codigoNF) {
      setMessage("Preencha todos os campos para vincular um fornecedor");
      setMessageType("error");
      return;
    }

    try {
      const response = await fetch("/api/produto-fornecedor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          produtoId: produto.id,
          fornecedorId,
          preco: parseInt((parseFloat(preco) * 100).toString()),
          multiplicador: parseFloat(multiplicador),
          codigoNF,
        }),
      });

      if (response.ok) {
        const novoFornecedor = await response.json();
        const fornecedor = fornecedores.find((f) => f.id === fornecedorId);
        if (fornecedor) {
          setFornecedoresVinculados((prev) => [
            ...prev,
            { ...novoFornecedor, fornecedor },
          ]);
        }
        setMessage("Fornecedor vinculado com sucesso");
        setMessageType("success");
      } else {
        setMessage("Erro ao vincular fornecedor");
        setMessageType("error");
      }
    } catch (error) {
      console.error("Erro ao vincular fornecedor", error);
      setMessage("Erro ao vincular fornecedor");
      setMessageType("error");
    }
  };

  const handleDelete = async (vinculoId: string) => {
    try {
      const response = await fetch(`/api/produto-fornecedor?id=${vinculoId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setFornecedoresVinculados(
          fornecedoresVinculados.filter((vinculo) => vinculo.id !== vinculoId)
        );
        setMessage("Vínculo removido com sucesso");
        setMessageType("success");
      } else {
        setMessage("Erro ao remover vínculo");
        setMessageType("error");
      }
    } catch (error) {
      console.error("Erro ao remover vínculo", error);
      setMessage("Erro ao remover vínculo");
      setMessageType("error");
    }
  };

  const handleEdit = (vinculo: ProdutoFornecedor) => {
    setEditingId(vinculo.id);
    setPreco(vinculo.preco.toString());
    setMultiplicador(vinculo.multiplicador.toString());
    setCodigoNF(vinculo.codigoNF);
  };

  const handleSaveEdit = async (vinculoId: string) => {
    if (!preco || !multiplicador || !codigoNF) {
      setMessage("Preencha todos os campos para salvar a edição");
      setMessageType("error");
      return;
    }

    try {
      const response = await fetch("/api/produto-fornecedor", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: vinculoId,
          preco: parseInt((parseFloat(preco) * 100).toString()),
          multiplicador: parseFloat(multiplicador),
          codigoNF,
        }),
      });

      if (response.ok) {
        const fornecedorAtualizado = await response.json();
        const fornecedor = fornecedoresVinculados.find(
          (vinculo) => vinculo.id === vinculoId
        )?.fornecedor;
        setFornecedoresVinculados((prev) =>
          prev.map((vinculo) =>
            vinculo.id === vinculoId
              ? { ...fornecedorAtualizado, fornecedor } // Mantemos o fornecedor original
              : vinculo
          )
        );
        setEditingId(null); // Sai do modo de edição
        setMessage("Fornecedor atualizado com sucesso");
        setMessageType("success");
      } else {
        setMessage("Erro ao atualizar fornecedor");
        setMessageType("error");
      }
    } catch (error) {
      console.error("Erro ao atualizar fornecedor", error);
      setMessage("Erro ao atualizar fornecedor");
      setMessageType("error");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-2xl w-full">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
          Fornecedores vinculados ao produto {produto.nome}
        </h2>

        <div className="space-y-4 max-h-60 overflow-y-auto">
          {fornecedoresVinculados.length > 0 ? (
            fornecedoresVinculados.map((fornecedor) => (
              <div
                key={fornecedor.id}
                className="flex justify-between items-center p-3 bg-gray-100 dark:bg-gray-700 rounded-md"
              >
                {editingId === fornecedor.id ? (
                  <div className="flex flex-col space-y-2">
                    <input
                      type="text"
                      placeholder="Preço"
                      value={preco}
                      onChange={(e) => setPreco(e.target.value)}
                      className="p-2 border border-gray-300 rounded-md bg-gray-50 dark:bg-gray-700"
                    />
                    <input
                      type="text"
                      placeholder="Multiplicador"
                      value={multiplicador}
                      onChange={(e) => setMultiplicador(e.target.value)}
                      className="p-2 border border-gray-300 rounded-md bg-gray-50 dark:bg-gray-700"
                    />
                    <input
                      type="text"
                      placeholder="Código NF"
                      value={codigoNF}
                      onChange={(e) => setCodigoNF(e.target.value)}
                      className="p-2 border border-gray-300 rounded-md bg-gray-50 dark:bg-gray-700"
                    />
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {fornecedor?.fornecedor?.nome ?? "Nome não disponível"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Preço:{" "}
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(fornecedor.preco)}{" "}
                      | Multiplicador:{" "}
                      {fornecedor?.multiplicador ??
                        "Multiplicador não disponível"}
                    </p>

                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Código NF: {fornecedor.codigoNF}
                    </p>
                  </div>
                )}

                <div className="flex space-x-2">
                  {editingId === fornecedor.id ? (
                    <button
                      className="bg-green-500 text-white px-2 py-1 rounded"
                      onClick={() => handleSaveEdit(fornecedor.id)}
                    >
                      Salvar
                    </button>
                  ) : (
                    <button
                      className="bg-blue-500 text-white px-2 py-1 rounded"
                      onClick={() => handleEdit(fornecedor)}
                    >
                      Editar
                    </button>
                  )}
                  <button
                    className="bg-red-500 text-white px-2 py-1 rounded"
                    onClick={() => handleDelete(fornecedor.id)}
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Nenhum fornecedor vinculado a este produto
            </p>
          )}
        </div>

        <div className="mt-4 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Vincular novo fornecedor
          </h3>

          <select
            value={fornecedorId || ""}
            onChange={(e) => setFornecedorId(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md bg-gray-50 dark:bg-gray-700"
          >
            <option value="">Selecione um fornecedor</option>
            {fornecedores.map((fornecedor) => (
              <option key={fornecedor.id} value={fornecedor.id}>
                {fornecedor.nome}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Preço"
            value={preco}
            onChange={(e) => setPreco(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md bg-gray-50 dark:bg-gray-700"
          />
          <input
            type="text"
            placeholder="Multiplicador"
            value={multiplicador}
            onChange={(e) => setMultiplicador(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md bg-gray-50 dark:bg-gray-700"
          />
          <input
            type="text"
            placeholder="Código NF"
            value={codigoNF}
            onChange={(e) => setCodigoNF(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md bg-gray-50 dark:bg-gray-700"
          />

          {message && (
            <div
              className={`text-sm ${
                messageType === "success" ? "text-green-600" : "text-red-600"
              }`}
            >
              {message}
            </div>
          )}

          <button
            onClick={handleVincularFornecedor}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Vincular
          </button>
          <button
            onClick={onClose}
            className="bg-gray-300 text-gray-700 px-4 py-2 rounded"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default FornecedorModal;
