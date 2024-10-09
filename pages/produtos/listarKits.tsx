// pages/listarKits.tsx
import { useEffect, useState } from "react";

interface Produto {
  id: number;
  nome: string;
  sku: string;
  kits?: {
    produto: {
      nome: string;
      sku: string;
    };
    quantidade: number;
  }[];
}

const ListarKits = () => {
  const [kits, setKits] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchKits = async () => {
      try {
        const response = await fetch("/api/kits");
        const data = await response.json();
        setKits(data); // Armazena os kits resolvidos
      } catch (error) {
        setError("Erro ao buscar kits");
      } finally {
        setLoading(false); // Carregamento completo
      }
    };

    fetchKits();
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
        Kits
      </h1>
      <ul className="space-y-4">
        {kits.map((kit) => (
          <li
            key={kit.id}
            className="flex flex-col justify-between items-start p-4 bg-gray-100 dark:bg-gray-700 rounded-md shadow-sm"
          >
            <div>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {kit.nome} (SKU: {kit.sku})
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Produtos no kit:
              </p>
              <ul className="ml-4 list-disc">
                {kit.kits && kit.kits.length > 0 ? (
                  kit.kits.map((kitProduto) => (
                    <li key={kitProduto.produto.sku}>
                      {kitProduto.produto.nome} - SKU: {kitProduto.produto.sku}{" "}
                      - Quantidade: {kitProduto.quantidade}
                    </li>
                  ))
                ) : (
                  <li>Este kit não contém produtos.</li>
                )}
              </ul>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ListarKits;
