"use client";
import { useState, useEffect, useCallback } from "react";

interface FetchState<T> {
  data: T[] | null;
  loading: boolean;
  error: string | null;
}

// Função para processar valores BigInt e converter para string
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const processBigIntValues = (data: any): any => {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === "bigint") {
    return data.toString();
  }

  if (Array.isArray(data)) {
    return data.map((item) => processBigIntValues(item));
  }

  if (typeof data === "object") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: { [key: string]: any } = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        result[key] = processBigIntValues(data[key]);
      }
    }
    return result;
  }

  return data;
};

export function useFetch<T>(url: string) {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const refetch = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Erro na requisição: ${response.status} ${response.statusText}`
        );
      }

      const responseData = await response.json();

      // Processar valores BigInt, convertendo para string
      const processedData = processBigIntValues(responseData);

      setState({
        data: processedData,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error("Erro no fetch:", error);
      setState({
        data: null,
        loading: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  }, [url]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    ...state,
    refetch,
  };
}
