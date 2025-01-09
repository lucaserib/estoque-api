"use client";
import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Saida {
  id: number;
  data: string;
  armazem: { nome: string };
  detalhes: {
    id: number;
    produto: { nome: string; sku: string };
    quantidade: number;
    isKit: boolean;
  }[];
}

const RegistroSaidas = () => {
  const [saidas, setSaidas] = useState<Saida[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSaidas = async () => {
      try {
        const response = await fetch("/api/saida");
        const data = await response.json();

        console.log("Dados recebidos da API:", data);

        if (Array.isArray(data)) {
          setSaidas(data);
        } else {
          console.error("Resposta da API não é um array:", data);
        }
      } catch (error) {
        console.error("Erro ao buscar saídas:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSaidas();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-200">
        <div className="text-xl font-medium">Carregando saídas...</div>
      </div>
    );
  }

  if (!Array.isArray(saidas) || saidas.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-200">
        <div className="text-xl font-medium">Nenhuma saída registrada.</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto mt-10 p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-6 text-center">
        Registro de Saídas
      </h1>
      <ul className="space-y-4">
        {saidas.map((saida) => (
          <li
            key={saida.id}
            className="p-6 bg-gray-50 dark:bg-gray-700 rounded-lg shadow-md transition-transform transform hover:scale-105"
          >
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
              Saída #{saida.id} -{" "}
              {format(new Date(saida.data), "dd/MM/yyyy", { locale: ptBR })}
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              <span className="font-medium">Armazém:</span> {saida.armazem.nome}
            </p>
            <ul className="mt-3 border-t border-gray-200 dark:border-gray-600 pt-3 space-y-2">
              {saida.detalhes.map((detalhe) => (
                <li
                  key={detalhe.id}
                  className="flex justify-between items-center text-gray-700 dark:text-gray-300 text-sm"
                >
                  <div>
                    <span className="font-semibold">{detalhe.produto.sku}</span>{" "}
                    - {detalhe.produto.nome}
                  </div>
                  <div className="text-gray-500 dark:text-gray-400">
                    Quantidade: {detalhe.quantidade}{" "}
                    {detalhe.isKit && (
                      <span className="text-xs bg-blue-500 text-white py-1 px-2 rounded-full ml-2">
                        Kit
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default RegistroSaidas;
