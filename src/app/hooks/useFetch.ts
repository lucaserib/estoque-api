"use client";
import { useState, useEffect, useCallback, DependencyList } from "react";

interface FetchState<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

const processBigIntValues = (data: unknown): unknown => {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === "bigint") {
    return data.toString();
  }

  if (Array.isArray(data)) {
    return data.map((item) => processBigIntValues(item));
  }

  if (typeof data === "object" && data !== null) {
    const result: Record<string, unknown> = {};
    for (const key in data as Record<string, unknown>) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        result[key] = processBigIntValues(
          (data as Record<string, unknown>)[key]
        );
      }
    }
    return result;
  }

  return data;
};

export function useFetch<T = unknown>(
  url: string,
  processData?: (data: unknown) => T,
  deps: DependencyList = []
) {
  const [state, setState] = useState<FetchState<T>>({
    data: (Array.isArray([]) ? [] : null) as unknown as T,
    loading: true,
    error: null,
  });

  const refetch = useCallback(async () => {
    if (!url) {
      setState((prev) => ({
        ...prev,
        loading: false,
      }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Erro na requisição: ${response.status} ${response.statusText}`
        );
      }

      const responseData = await response.json();

      const processedResponse = processBigIntValues(responseData);

      const processedData = processData
        ? processData(processedResponse)
        : (processedResponse as T);

      setState({
        data: processedData,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error("Erro no fetch:", error);
      setState({
        data: (Array.isArray([]) ? [] : null) as unknown as T,
        loading: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, processData, ...deps]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    ...state,
    refetch,
  };
}
