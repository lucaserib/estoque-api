"use client";
import { useState, useEffect, useCallback } from "react";

interface FetchState<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

// Function to process BigInt values and convert to string
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

/**
 * Custom hook to fetch data from an API endpoint
 * @param url The URL to fetch data from
 * @param processData Optional function to process the response data
 * @param deps Additional dependencies for the useEffect hook
 */
export function useFetch<T extends any[]>(
  url: string,
  processData?: (data: any[]) => T,
  deps: any[] = []
) {
  // Initialize with empty array of the correct type
  const [state, setState] = useState<FetchState<T>>({
    data: [] as unknown as T,
    loading: true,
    error: null,
  });

  const refetch = useCallback(async () => {
    // If URL is empty, don't fetch
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

      let responseData = await response.json();

      // Ensure responseData is an array
      if (!Array.isArray(responseData)) {
        console.warn("API response is not an array, converting to array");
        responseData = [responseData];
      }

      // Process BigInt values
      responseData = processBigIntValues(responseData);

      // Apply processData function if provided
      const processedData = processData
        ? processData(responseData)
        : (responseData as T);

      setState({
        data: processedData,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error("Erro no fetch:", error);
      setState({
        data: [] as unknown as T,
        loading: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  }, [url, processData, ...deps]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    ...state,
    refetch,
  };
}
