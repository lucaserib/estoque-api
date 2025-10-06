import { useState, useCallback, useRef } from "react";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface UseReplenishmentCacheOptions {
  ttl?: number; // Time to live in milliseconds
}

/**
 * Custom hook for caching replenishment data with TTL
 * Prevents excessive API calls and improves performance
 */
export function useReplenishmentCache<T>(options: UseReplenishmentCacheOptions = {}) {
  const { ttl = 5 * 60 * 1000 } = options; // Default 5 minutes
  const cacheRef = useRef<Map<string, CacheEntry<T>>>(new Map());
  const [, forceUpdate] = useState({});

  /**
   * Get cached data if valid, otherwise return null
   */
  const get = useCallback(
    (key: string): T | null => {
      const entry = cacheRef.current.get(key);
      if (!entry) return null;

      const isExpired = Date.now() - entry.timestamp > ttl;
      if (isExpired) {
        cacheRef.current.delete(key);
        return null;
      }

      return entry.data;
    },
    [ttl]
  );

  /**
   * Set data in cache with current timestamp
   */
  const set = useCallback((key: string, data: T): void => {
    cacheRef.current.set(key, {
      data,
      timestamp: Date.now(),
    });
    forceUpdate({});
  }, []);

  /**
   * Clear specific key or entire cache
   */
  const clear = useCallback((key?: string): void => {
    if (key) {
      cacheRef.current.delete(key);
    } else {
      cacheRef.current.clear();
    }
    forceUpdate({});
  }, []);

  /**
   * Check if cache has valid data for key
   */
  const has = useCallback(
    (key: string): boolean => {
      return get(key) !== null;
    },
    [get]
  );

  /**
   * Get all cached keys
   */
  const keys = useCallback((): string[] => {
    return Array.from(cacheRef.current.keys());
  }, []);

  return {
    get,
    set,
    clear,
    has,
    keys,
  };
}
