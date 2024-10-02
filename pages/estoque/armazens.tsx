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
  armazemId: number;
}

interface Armazem {
  id: number;
  nome: string;
}

const Estoque = () => {
  const [estoque, setEstoque] = useState<Estoque[]>([]);
  const [armazens, setArmazens] = useState<Armazem[]>([]); // Adicionado para armazenar os armazéns
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [armazemSelecionado, setArmazemSelecionado] = useState<number | null>(
    null
  );

  // Função para buscar o estoque do armazém selecionado
  const fetchEstoque = async (armazemId: number | null) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/estoque/armazens${armazemId ? `?armazemId=${armazemId}` : ""}`
      );
      const data = await response.json();
      setEstoque(data);
    } catch (error) {
      setError("Erro ao buscar estoque");
    } finally {
      setLoading(false);
    }
  };

  // Função para buscar os armazéns
  const fetchArmazens = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/estoque/criarArmazem`); // Alterado para a rota correta
      const data = await response.json();
      setArmazens(data); // Atualizando a lista de armazéns
    } catch (error) {
      setError("Erro ao buscar armazéns");
    } finally {
      setLoading(false);
    }
  };

  // Efeito para buscar os armazéns ao carregar o componente
  useEffect(() => {
    fetchArmazens();
  }, []);

  // Efeito para buscar o estoque sempre que o armazém for alterado
  useEffect(() => {
    if (armazemSelecionado !== null) {
      fetchEstoque(armazemSelecionado);
    }
  }, [armazemSelecionado]);

  if (loading) {
    return <p className="text-center mt-10">Carregando...</p>;
  }

  if (error) {
    return <p className="text-center mt-10 text-red-500">{error}</p>;
  }

  return (
    <div className="max-w-4xl mx-auto mt-10 p-6 bg-white dark:bg-gray-900 rounded-md shadow-md">
      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
        Estoque
      </h1>
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
          onChange={(e) => setArmazemSelecionado(Number(e.target.value))}
        >
          <option value="">Selecione um armazém</option>
          {armazens.map((armazem) => (
            <option key={armazem.id} value={armazem.id}>
              {armazem.nome}
            </option>
          ))}
        </select>
      </div>

      {armazemSelecionado ? (
        <div>
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
            Produtos no Armazém {armazemSelecionado}
          </h2>
          {estoque.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400">
              Nenhum produto encontrado neste armazém.
            </p>
          ) : (
            <ul className="space-y-4">
              {estoque
                .filter((item) => item.armazemId === armazemSelecionado)
                .map(({ produto, quantidade, valorUnitario }) => (
                  <li
                    key={produto.id}
                    className="flex justify-between items-center p-4 bg-gray-100 dark:bg-gray-700 rounded-md shadow-sm"
                  >
                    <div>
                      <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {produto.nome}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        SKU: {produto.sku}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Quantidade: {quantidade}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Valor Unitário: R${valorUnitario.toFixed(2)}
                      </p>
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="text-center text-gray-500 dark:text-gray-400">
          Selecione um armazém para visualizar os produtos.
        </p>
      )}
    </div>
  );
};

export default Estoque;
