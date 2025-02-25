import { useEffect, useState } from "react";

export const useFetch = <T>(url: string, filter?: (data: T[]) => T[]) => {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(url);
        const result = await response.json();
        setData(filter ? filter(result) : result);
      } catch (err) {
        setError("Erro ao buscar dados");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [url]);
  return { data, loading, error };
};
