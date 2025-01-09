"use client";
import { useEffect, useState } from "react";

interface Produto {
  id: number;
  nome: string;
  sku: string;
  isKit: boolean;
  componentes?: Array<{ produto: Produto; quantidade: number }>;
}

const ListarKits = () => {
  const [kits, setKits] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchKits = async () => {
      try {
        const response = await fetch("/api/kits", {
          method: "GET",
          headers: {
            "Cache-Control": "no-cache",
          },
        });
        const data = await response.json();
        if (Array.isArray(data)) {
          setKits(data.filter((produto) => produto.isKit));
        } else {
          setError("Dados inválidos recebidos da API");
        }
      } catch (error) {
        setError("Erro ao buscar kits");
      } finally {
        setLoading(false);
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
    <div className="max-w-2xl mx-auto mt-10">
      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
        Kits
      </h1>
      <ul className="space-y-4">
        {kits.map((kit) => (
          <li
            key={kit.id}
            className="p-4 bg-white dark:bg-gray-900 rounded-md shadow-md"
          >
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {kit.nome}
            </h2>
            <p className="text-gray-700 dark:text-gray-300">SKU: {kit.sku}</p>
            {kit.componentes?.length ? (
              <div className="mt-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Componentes do Kit:
                </h3>
                <ul className="mt-2 space-y-1">
                  {kit.componentes?.map((Componente, index) => (
                    <li
                      key={index}
                      className="text-gray-700 dark:text-gray-300"
                    >
                      {Componente?.produto?.nome || "Produto não encontrado"}{" "}
                      (SKU: {Componente?.produto?.sku || "N/A"}) - Quantidade:{" "}
                      {Componente?.quantidade || 0}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-4 text-gray-700 dark:text-gray-300">
                Kit sem componentes.
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ListarKits;
