// src/hooks/useFetch.ts
import { useState, useEffect, useCallback } from "react";

interface UseFetchResult<T> {
  data: T[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useFetch = <T>(
  url: string,
  transform?: (data: T[]) => T[],
  dependencies: any[] = []
): UseFetchResult<T> => {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Erro ao buscar dados: ${response.status} ${response.statusText}`
        );
      }

      const result = await response.json();

      const transformedData = transform ? transform(result) : result;

      setData(transformedData);
    } catch (err) {
      console.error("Erro no useFetch:", err);
      setError(
        err instanceof Error ? err.message : "Erro desconhecido ao buscar dados"
      );
    } finally {
      setLoading(false);
    }
  }, [url, transform]);

  useEffect(() => {
    fetchData();
  }, [fetchData, ...dependencies]);

  return { data, loading, error, refetch: fetchData };
};
