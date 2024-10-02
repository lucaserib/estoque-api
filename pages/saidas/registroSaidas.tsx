import React, { useEffect, useState } from "react";

interface Produto {
  id: number;
  nome: string;
  sku: string;
}

interface Armazem {
  id: number;
  nome: string;
}

interface Saida {
  id: number;
  produto: Produto;
  quantidade: number;
  data: string;
  armazem: Armazem;
}

const RegistroSaidas = () => {
  const [saidas, setSaidas] = useState<Saida[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchSaidas = async () => {
      try {
        const response = await fetch("/api/saidas");
        const data = await response.json();
        setSaidas(data);
      } catch (error) {
        setError("Erro ao buscar saídas");
      } finally {
        setLoading(false);
      }
    };

    fetchSaidas();
  }, []);

  if (loading) {
    return <p className="text-center mt-10">Carregando...</p>;
  }

  if (error) {
    return <p className="text-center mt-10 text-red-500">{error}</p>;
  }

  return (
    <div className="max-w-4xl mx-auto mt-10 p-6 bg-white dark:bg-gray-900 rounded-md shadow-md">
      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
        Registro de Saídas
      </h1>
      <ul className="space-y-4">
        {saidas.map((saida) => (
          <li
            key={saida.id}
            className="flex justify-between items-center p-4 bg-gray-100 dark:bg-gray-700 rounded-md shadow-sm"
          >
            <div>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Produto: {saida.produto.nome} (SKU: {saida.produto.sku})
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Quantidade: {saida.quantidade}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Data: {new Date(saida.data).toLocaleDateString()}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Armazém: {saida.armazem.nome}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default RegistroSaidas;
