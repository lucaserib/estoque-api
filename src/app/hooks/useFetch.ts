"use client";
import { useState, useEffect, useCallback } from "react";

interface FetchState<T> {
  data: T[] | null;
  loading: boolean;
  error: string | null;
}

// Definindo um tipo recursivo para os dados que podem conter BigInt
type JsonValue =
  | string
  | number
  | boolean
  | null
  | bigint
  | { [key: string]: JsonValue }
  | JsonValue[];

// Função para processar valores BigInt e converter para string
const processBigIntValues = <T extends JsonValue>(data: T): T => {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === "bigint") {
    return data.toString() as unknown as T;
  }

  if (Array.isArray(data)) {
    return data.map((item) => processBigIntValues(item)) as unknown as T;
  }

  if (typeof data === "object") {
    const result: Record<string, JsonValue> = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        result[key] = processBigIntValues(
          (data as Record<string, JsonValue>)[key]
        );
      }
    }
    return result as unknown as T;
  }

  return data;
};

export function useFetch<T extends JsonValue>(url: string) {
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
      const processedData = processBigIntValues<T[]>(responseData);

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
