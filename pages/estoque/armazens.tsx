// pages/armazens.tsx
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
      {selectedArmazemId !== null ? (
        <div>
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
            Estoque do Armazém
          </h2>
          <ul className="space-y-4">
            {estoque.map((item) => (
              <li
                key={item.id}
                className="flex justify-between items-center p-4 bg-gray-100 dark:bg-gray-700 rounded-md shadow-sm"
              >
                <div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {item.produto.nome} (SKU: {item.produto.sku})
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Quantidade: {item.quantidade}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Valor Unitário: {item.valorUnitario}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-center mt-10 text-gray-600 dark:text-gray-400">
          Selecione um armazém para visualizar os produtos.
        </p>
      )}
    </div>
  );
};

export default Armazens;
