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

interface FornecedorModalProps {
  produto: Produto;
  onClose: () => void;
}

const FornecedorModal = ({ produto, onClose }: FornecedorModalProps) => {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
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

    fetchFornecedores();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fornecedorId || !preco || !multiplicador || !codigoNF) {
      setMessage("Preencha todos os campos");
      setMessageType("error");
      return;
    }

    const vinculo = {
      produtoId: produto.id,
      fornecedorId,
      preco: parseFloat(preco),
      multiplicador: parseFloat(multiplicador),
      codigoNF,
    };

    try {
      const response = await fetch("/api/produto-fornecedor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(vinculo),
      });

      if (response.ok) {
        setMessage("Fornecedor vinculado com sucesso!");
        setMessageType("success");
        onClose(); // Fecha o modal após o sucesso
      } else {
        setMessage("Erro ao vincular fornecedor");
        setMessageType("error");
      }
    } catch (error) {
      console.error("Erro ao vincular fornecedor:", error);
      setMessage("Erro ao vincular fornecedor");
      setMessageType("error");
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white p-6 rounded-md shadow-md w-full max-w-lg">
        <h2 className="text-xl font-bold mb-4">Vincular Fornecedor</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700">Fornecedor</label>
            <select
              value={fornecedorId || ""}
              onChange={(e) => setFornecedorId(Number(e.target.value))}
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
            <label className="block text-gray-700">Preço</label>
            <input
              type="text"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
              className="mt-1 block w-full"
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700">Multiplicador</label>
            <input
              type="text"
              value={multiplicador}
              onChange={(e) => setMultiplicador(e.target.value)}
              className="mt-1 block w-full"
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700">Código NF</label>
            <input
              type="text"
              value={codigoNF}
              onChange={(e) => setCodigoNF(e.target.value)}
              className="mt-1 block w-full"
            />
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
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-500 text-white px-4 py-2 rounded mr-2"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded"
            >
              Vincular
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FornecedorModal;
