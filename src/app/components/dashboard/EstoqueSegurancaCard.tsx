"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";

interface ProdutoSeguranca {
  id: number;
  nome: string;
  sku: string;
  quantidade: number;
  estoqueSeguranca: number;
  armazem: string;
}

const EstoqueSegurancaCard = () => {
  const [produtos, setProdutos] = useState<ProdutoSeguranca[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/estoque-seguranca")
      .then((res) => res.json())
      .then((data) => setProdutos(data))
      .catch((err) =>
        console.error("Erro ao buscar estoque de segurança:", err)
      )
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <Card className="shadow-md border-red-400 border">
      <CardHeader className="flex justify-between">
        <CardTitle className="text-lg font-bold text-red-600">
          <AlertTriangle className="inline-block w-5 h-5 mr-2 text-red-600" />
          Estoque de Segurança
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-32 w-full rounded-md" />
        ) : produtos.length > 0 ? (
          <ul className="space-y-3">
            {produtos.map((produto) => (
              <li
                key={produto.id}
                className="flex justify-between p-3 bg-red-50 border border-red-300 rounded-md shadow-sm"
              >
                <div>
                  <p className="font-semibold text-gray-900">{produto.nome}</p>
                  <p className="text-sm text-gray-600">SKU: {produto.sku}</p>
                  <p className="text-sm text-gray-600">
                    Armazém: {produto.armazem}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-red-600">
                    Estoque Mínimo: {produto.estoqueSeguranca}
                  </p>
                  <p className="text-sm text-gray-500">
                    Estoque Atual: {produto.quantidade}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-center text-gray-600">
            Tudo certo! Nenhum produto abaixo do estoque de segurança.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default EstoqueSegurancaCard;
