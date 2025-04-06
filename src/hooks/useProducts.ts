// src/hooks/useProducts.ts
import { useState, useEffect, useCallback } from "react";
import { normalizeProductsEAN } from "@/utils/ean";
import { Produto } from "@/app/(root)/produtos/types";

interface UseProductsParams {
  filter?: string;

  armazemId?: string;

  autoLoad?: boolean;
}

export const useProducts = (params: UseProductsParams = {}) => {
  const { filter = "", armazemId, autoLoad = true } = params;

  const [products, setProducts] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Construir URL com parâmetros
      let url = "/api/produtos";
      const queryParams = [];

      if (filter) queryParams.push(`search=${encodeURIComponent(filter)}`);
      if (armazemId)
        queryParams.push(`armazemId=${encodeURIComponent(armazemId)}`);

      if (queryParams.length > 0) {
        url += `?${queryParams.join("&")}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Erro ao carregar produtos");
      }

      const data = await response.json();

      // Normalizar os produtos e garantir que correspondam ao tipo Produto
      const normalizedProducts = normalizeProductsEAN(data);

      // Como a API já usa serializeWithEAN, os dados já devem ter codigoEAN configurado
      setProducts(normalizedProducts as Produto[]);
    } catch (error) {
      console.error("Erro ao carregar produtos:", error);
      setError(error instanceof Error ? error.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [filter, armazemId]);

  // Carregar produtos ao montar o componente ou quando os parâmetros mudarem
  useEffect(() => {
    if (autoLoad) {
      fetchProducts();
    }
  }, [fetchProducts, autoLoad, refreshTrigger]);

  // Função para forçar o recarregamento de produtos
  const refresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  return {
    products,
    loading,
    error,
    refresh,
    fetchProducts,
  };
};
