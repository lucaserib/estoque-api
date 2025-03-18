// app/saidas/components/SaidaList.tsx
"use client";
import { useFetch } from "@/app/hooks/useFetch";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Saida } from "../types";

const SaidaList = () => {
  const { data: saidas, loading, error } = useFetch<Saida[]>("/api/saida");

  if (loading) {
    return (
      <p className="text-center mt-10 text-gray-500 dark:text-gray-400">
        Carregando saídas...
      </p>
    );
  }

  if (error || !saidas?.length) {
    return (
      <p className="text-center mt-10 text-gray-500 dark:text-gray-400">
        {error || "Nenhuma saída registrada."}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <ul className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {(saidas ?? []).map((saida) => (
          <li
            key={saida.id}
            className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200"
          >
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Saída #{saida.id}
              </h2>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {format(new Date(saida.data), "dd/MM/yyyy", { locale: ptBR })}
              </span>
            </div>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              <span className="font-medium">Armazém:</span> {saida.armazem.nome}
            </p>
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Itens:
              </h3>
              <ul className="space-y-2 max-h-40 overflow-y-auto">
                {saida.detalhes.map((detalhe) => (
                  <li
                    key={detalhe.id}
                    className="flex justify-between items-center text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 p-2 rounded-md"
                  >
                    <span>
                      {detalhe.produto.sku} - {detalhe.produto.nome}
                    </span>
                    <span className="flex items-center gap-2">
                      Qtd: {detalhe.quantidade}
                      {detalhe.isKit && (
                        <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded-full">
                          Kit
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SaidaList;
