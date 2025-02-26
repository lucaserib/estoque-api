// app/produtos/components/KitList.tsx
"use client";
import { useFetch } from "@/app/hooks/useFetch";
import { Kit } from "../types";

const KitList = () => {
  const { data: kits, loading, error } = useFetch<Kit>("/api/kits");

  if (loading) {
    return (
      <p className="text-gray-500 dark:text-gray-400 text-center">
        Carregando kits...
      </p>
    );
  }

  if (error) {
    return <p className="text-red-500 text-center">{error}</p>;
  }

  return (
    <div className="space-y-6">
      {kits.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-center">
          Nenhum kit encontrado.
        </p>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {kits.map((kit) => (
            <li
              key={kit.id}
              className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200"
            >
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {kit.nome}
                </h2>
                <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
                  SKU: {kit.sku}
                </span>
              </div>
              {kit.ean && (
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  EAN: {kit.ean}
                </p>
              )}
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  Componentes:
                </h3>
                {kit.componentes.length > 0 ? (
                  <ul className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                    {kit.componentes.map((componente, index) => (
                      <li
                        key={index}
                        className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 p-2 rounded-md flex justify-between items-center"
                      >
                        <span>Produto ID: {componente.produtoId}</span>
                        <span className="text-blue-600 dark:text-blue-400 font-medium">
                          Qtd: {componente.quantidade}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    Sem componentes.
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default KitList;
