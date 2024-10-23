import { useEffect, useState } from "react";

interface Fornecedor {
  id: number;
  nome: string;
}

interface ProdutoFornecedor {
  id: number;
  fornecedor: Fornecedor;
  preco: number;
  multiplicador: number;
  codigoNF: string;
}

interface Produto {
  id: number;
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
  const [fornecedorId, setFornecedorId] = useState<number | null>(null);
  const [preco, setPreco] = useState("");
  const [multiplicador, setMultiplicador] = useState("");
  const [codigoNF, setCodigoNF] = useState("");
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
          preco: parseFloat(preco),
          multiplicador: parseFloat(multiplicador),
          codigoNF,
        }),
      });

      if (response.ok) {
        const novoFornecedor = await response.json();
        setFornecedoresVinculados((prev) => [...prev, novoFornecedor]);
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
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {fornecedor?.fornecedor?.nome ?? "Nome não disponível"}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Preço: {fornecedor?.preco ?? "Preço não disponível"} |
                    Multiplicador:{" "}
                    {fornecedor?.multiplicador ??
                      "Multiplicador não disponível"}
                  </p>

                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Código NF: {fornecedor.codigoNF}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-600 dark:text-gray-400">
              Nenhum fornecedor vinculado.
            </p>
          )}
        </div>

        {/* Formulário para vincular novo fornecedor */}
        <div className="mt-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Vincular novo fornecedor
          </h3>
          <select
            value={fornecedorId || ""}
            onChange={(e) => setFornecedorId(Number(e.target.value))}
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
            <p
              className={`text-sm ${
                messageType === "success" ? "text-green-500" : "text-red-500"
              }`}
            >
              {message}
            </p>
          )}
          <div className="flex justify-end">
            <button
              onClick={handleVincularFornecedor}
              className="bg-blue-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-600"
            >
              Vincular Fornecedor
            </button>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="bg-red-500 text-white px-4 py-2 rounded-md"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default FornecedorModal;
