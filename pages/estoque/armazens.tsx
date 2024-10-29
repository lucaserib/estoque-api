import { useEffect, useState } from "react";

interface Produto {
  id: number;
  nome: string;
  sku: string;
}

interface Estoque {
  id: number;
  produto: Produto;
  quantidade: number;
  valorUnitario: number;
  estoqueSeguranca: number;
}

interface Armazem {
  id: number;
  nome: string;
}

const Armazens = () => {
  const [armazens, setArmazens] = useState<Armazem[]>([]);
  const [estoque, setEstoque] = useState<Estoque[]>([]);
  const [selectedArmazemId, setSelectedArmazemId] = useState<number | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [currentEstoque, setCurrentEstoque] = useState<Estoque | null>(null);
  const [searchTerm, setSearchTerm] = useState(""); // Novo estado de pesquisa

  useEffect(() => {
    const fetchArmazens = async () => {
      try {
        const response = await fetch("/api/estoque/armazens");
        const data = await response.json();
        setArmazens(data);
      } catch (error) {
        setError("Erro ao buscar armazéns");
      } finally {
        setLoading(false);
      }
    };

    fetchArmazens();
  }, []);

  useEffect(() => {
    if (selectedArmazemId !== null) {
      const fetchEstoque = async () => {
        setLoading(true);
        setError("");
        try {
          const response = await fetch(`/api/estoque/${selectedArmazemId}`);
          const data = await response.json();
          setEstoque(data);
        } catch (error) {
          setError("Erro ao buscar estoque");
        } finally {
          setLoading(false);
        }
      };

      fetchEstoque();
    }
  }, [selectedArmazemId]);

  const handleSaveEstoqueSeguranca = async () => {
    if (currentEstoque) {
      try {
        const response = await fetch(`/api/estoque/estoqueSeguranca`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            produtoId: currentEstoque.produto.id,
            armazemId: selectedArmazemId,
            estoqueSeguranca: currentEstoque.estoqueSeguranca,
          }),
        });
        if (!response.ok) {
          throw new Error("Erro ao salvar estoque de segurança");
        }
        setShowModal(false);
        setCurrentEstoque(null);
        // Re-fetch the stock data
        if (selectedArmazemId !== null) {
          const response = await fetch(`/api/estoque/${selectedArmazemId}`);
          const data = await response.json();
          setEstoque(data);
        }
      } catch (error) {
        setError("Erro ao salvar estoque de segurança");
      }
    }
  };

  // Função para filtrar os produtos com base no nome ou SKU
  const filteredEstoque = estoque.filter(
    (item) =>
      item.produto.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.produto.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <p className="text-center mt-10">Carregando...</p>;
  }

  if (error) {
    return <p className="text-center mt-10 text-red-500">{error}</p>;
  }

  return (
    <div className="max-w-4xl mx-auto mt-10 p-6 bg-white dark:bg-gray-900 rounded-md shadow-md">
      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
        Armazéns
      </h1>
      <div className="mb-4">
        <label
          htmlFor="armazem"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Selecione um Armazém
        </label>
        <select
          id="armazem"
          value={selectedArmazemId || ""}
          onChange={(e) => setSelectedArmazemId(Number(e.target.value))}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
        >
          <option value="">Selecione um armazém</option>
          {armazens.map((armazem) => (
            <option key={armazem.id} value={armazem.id}>
              {armazem.nome}
            </option>
          ))}
        </select>
      </div>

      {/* Campo de pesquisa */}
      <div className="mb-4">
        <label
          htmlFor="search"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Pesquisar por Nome ou SKU
        </label>
        <input
          id="search"
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Digite o nome ou SKU do produto"
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
        />
      </div>

      {selectedArmazemId !== null ? (
        <div>
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
            Estoque do Armazém
          </h2>
          <ul className="space-y-4">
            {filteredEstoque.map((item) => (
              <li
                key={item.id}
                className={`flex justify-between items-center p-4 rounded-md shadow-sm ${
                  item.quantidade < item.estoqueSeguranca
                    ? "bg-red-200 dark:bg-red-800"
                    : "bg-gray-100 dark:bg-gray-700"
                }`}
              >
                <div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {item.produto.nome} (SKU: {item.produto.sku})
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Quantidade: {item.quantidade}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Estoque de Segurança: {item.estoqueSeguranca}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Valor Unitário: {item.valorUnitario}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setCurrentEstoque(item);
                    setShowModal(true);
                  }}
                  className="ml-4 px-4 py-2 bg-blue-500 text-white rounded-md"
                >
                  Editar Estoque de Segurança
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-center mt-10 text-gray-600 dark:text-gray-400">
          Selecione um armazém para visualizar os produtos.
        </p>
      )}

      {showModal && currentEstoque && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-md shadow-md">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
              Editar Estoque de Segurança
            </h2>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Estoque de Segurança
            </label>
            <input
              type="number"
              value={currentEstoque.estoqueSeguranca}
              onChange={(e) =>
                setCurrentEstoque({
                  ...currentEstoque,
                  estoqueSeguranca: Number(e.target.value),
                })
              }
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            />
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="mr-4 px-4 py-2 bg-gray-500 text-white rounded-md"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEstoqueSeguranca}
                className="px-4 py-2 bg-blue-500 text-white rounded-md"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Armazens;
