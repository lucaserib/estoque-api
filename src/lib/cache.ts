import { redis } from "@/lib/redis";

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

type SmartDataType =
  | "products"
  | "prices"
  | "stock"
  | "orders"
  | "sales"
  | "account"
  | "auth"
  | "user"
  | "analytics"
  | "metrics"
  | "categories"
  | "fees"
  | "pendencias"
  | "financeiro"
  | "default";

const BASE_TTL_MS: Record<SmartDataType, number> = {
  products: 3 * 60 * 1000,
  prices: 90 * 1000,
  stock: 2 * 60 * 1000,
  orders: 3 * 60 * 1000,
  sales: 3 * 60 * 1000,
  account: 30 * 60 * 1000,
  auth: 20 * 60 * 1000,
  user: 25 * 60 * 1000,
  analytics: 3 * 60 * 1000,
  metrics: 3 * 60 * 1000,
  categories: 24 * 60 * 60 * 1000,
  fees: 12 * 60 * 60 * 1000,
  default: 5 * 60 * 1000,
  pendencias: 60 * 1000,
  financeiro: 60 * 1000,
};

function getSmartTTL(dataType: string, context?: string): number {
  let ttl = BASE_TTL_MS[dataType as SmartDataType] ?? BASE_TTL_MS.default;

  if (context) {
    if (context.includes("realtime") || context.includes("live")) {
      ttl = Math.min(ttl, 60 * 1000);
    }
    if (context.includes("historical") || context.includes("90d")) {
      ttl = Math.max(ttl, 30 * 60 * 1000);
    }
    if (context.includes("listing") || context.includes("products")) {
      ttl = Math.min(ttl, 3 * 60 * 1000);
    }
  }

  return ttl;
}

const KEY_PREFIX = "mlcache:";

class IntelligentCache {
  private memory = new Map<string, CacheItem<unknown>>();
  private readonly maxMemoryEntries = 500;
  private hitCount = 0;
  private missCount = 0;

  private prefixed(key: string): string {
    return `${KEY_PREFIX}${key}`;
  }

  async set<T>(
    key: string,
    data: T,
    dataType: string = "default",
    context?: string
  ): Promise<void> {
    const ttlMs = getSmartTTL(dataType, context);

    if (redis) {
      await redis.set(this.prefixed(key), data, {
        px: ttlMs,
      });
      return;
    }

    if (this.memory.size >= this.maxMemoryEntries) {
      this.cleanupMemory();
    }

    this.memory.set(key, { data, timestamp: Date.now(), ttl: ttlMs });
  }

  async get<T>(key: string): Promise<T | null> {
    if (redis) {
      const value = await redis.get<T>(this.prefixed(key));
      if (value === null || value === undefined) {
        this.missCount++;
        return null;
      }
      this.hitCount++;
      return value;
    }

    const item = this.memory.get(key) as CacheItem<T> | undefined;
    if (!item) {
      this.missCount++;
      return null;
    }

    if (Date.now() - item.timestamp > item.ttl) {
      this.memory.delete(key);
      this.missCount++;
      return null;
    }

    this.hitCount++;
    return item.data;
  }

  async delete(key: string): Promise<void> {
    if (redis) {
      await redis.del(this.prefixed(key));
      return;
    }
    this.memory.delete(key);
  }

  async countPattern(pattern: string): Promise<number> {
    if (redis) {
      const keys = await redis.keys(`${this.prefixed(pattern)}*`);
      return keys.length;
    }

    let count = 0;
    for (const key of this.memory.keys()) {
      if (key.includes(pattern)) count++;
    }
    return count;
  }

  async invalidatePattern(pattern: string): Promise<number> {
    if (redis) {
      const keys = await redis.keys(`${this.prefixed(pattern)}*`);
      if (keys.length === 0) return 0;
      await redis.del(...keys);
      return keys.length;
    }

    let deleted = 0;
    for (const key of this.memory.keys()) {
      if (key.includes(pattern)) {
        this.memory.delete(key);
        deleted++;
      }
    }
    return deleted;
  }

  private cleanupMemory(): void {
    const now = Date.now();
    for (const [key, item] of this.memory.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.memory.delete(key);
      }
    }

    if (this.memory.size >= this.maxMemoryEntries) {
      const entries = Array.from(this.memory.entries()).sort(
        (a, b) => a[1].timestamp - b[1].timestamp
      );
      const toRemove = Math.floor(this.maxMemoryEntries * 0.2);
      for (let i = 0; i < toRemove && i < entries.length; i++) {
        this.memory.delete(entries[i][0]);
      }
    }
  }

  getStats(): {
    backend: "redis" | "memory";
    size: number;
    hitRate: number;
    hits: number;
    misses: number;
    efficiency: string;
  } {
    const total = this.hitCount + this.missCount;
    const hitRate = total > 0 ? (this.hitCount / total) * 100 : 0;
    return {
      backend: redis ? "redis" : "memory",
      size: this.memory.size,
      hitRate: Math.round(hitRate * 100) / 100,
      hits: this.hitCount,
      misses: this.missCount,
      efficiency:
        hitRate > 80
          ? "Excelente"
          : hitRate > 60
          ? "Boa"
          : hitRate > 40
          ? "Regular"
          : "Baixa",
    };
  }

  private getUserKey(userId: string, baseKey: string): string {
    return `user:${userId}:${baseKey}`;
  }

  async setForUser<T>(
    userId: string,
    key: string,
    data: T,
    dataType: string = "default",
    context?: string
  ): Promise<void> {
    await this.set(this.getUserKey(userId, key), data, dataType, context);
  }

  async getForUser<T>(userId: string, key: string): Promise<T | null> {
    return this.get<T>(this.getUserKey(userId, key));
  }

  async deleteForUser(userId: string, key: string): Promise<void> {
    await this.delete(this.getUserKey(userId, key));
  }

  async invalidateUser(userId: string): Promise<number> {
    return this.invalidatePattern(`user:${userId}:`);
  }
}

export const mlCache = new IntelligentCache();

export function createCacheKey(...parts: (string | number)[]): string {
  return parts.join(":");
}

export async function getUserCacheStats(userId: string) {
  const entries = await mlCache.countPattern(`user:${userId}:`);
  return { entries, memoryUsageKB: 0 };
}

export async function invalidateUserSession(userId: string): Promise<number> {
  return mlCache.invalidateUser(userId);
}

export async function withUserCache<T>(
  userId: string,
  key: string,
  fetcher: () => Promise<T>,
  dataType: string = "default",
  context?: string
): Promise<T> {
  const cached = await mlCache.getForUser<T>(userId, key);
  if (cached !== null) {
    return cached;
  }

  const data = await fetcher();
  await mlCache.setForUser(userId, key, data, dataType, context);
  return data;
}

export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  dataType: string = "default",
  context?: string
): Promise<T> {
  const cached = await mlCache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  const data = await fetcher();
  await mlCache.set(key, data, dataType, context);
  return data;
}
