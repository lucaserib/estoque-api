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

        console.log("Dados recebidos da API:", data); // Adiciona log para verificar os dados

        // Verificar se a resposta é um array
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
    return <div>Carregando saídas...</div>;
  }

  if (!Array.isArray(saidas) || saidas.length === 0) {
    return <div>Nenhuma saída registrada.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto mt-10 p-6 bg-white dark:bg-gray-900 rounded-md shadow-md">
      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
        Registro de Saídas
      </h1>
      <ul className="divide-y divide-gray-200">
        {saidas.map((saida) => (
          <li key={saida.id} className="py-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Saída #{saida.id} -{" "}
              {format(new Date(saida.data), "dd/MM/yyyy", { locale: ptBR })}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Armazém: {saida.armazem.nome}
            </p>
            <ul className="mt-2 space-y-1">
              {saida.detalhes.map((detalhe) => (
                <li
                  key={detalhe.id}
                  className="text-gray-800 dark:text-gray-300"
                >
                  {detalhe.produto.sku} ({detalhe.produto.nome}) - Quantidade:{" "}
                  {detalhe.quantidade} {detalhe.isKit ? "(Kit)" : ""}
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
