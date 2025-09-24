import { clear } from "console";

// Cache inteligente para APIs do Mercado Livre com TTL dinâmico
interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live em ms
  dataType: string; // Tipo de dados para TTL inteligente
  context?: string; // Contexto adicional
}

class IntelligentCache {
  private cache = new Map<string, CacheItem<unknown>>();
  private maxSize = 500; // ✅ AUMENTO: Mais itens no cache para melhor performance
  private hitCount = 0;
  private missCount = 0;
  private readonly VERSION = "2.0";

  private getSmartTTL(dataType: string, context?: string): number {
    const baseTTL = {
      // Dados de produtos (mudam frequentemente)
      products: 3 * 60 * 1000, // 3 minutos
      prices: 90 * 1000, // 90 segundos
      stock: 2 * 60 * 1000, // 2 minutos

      // Dados de vendas (histórico mais estável)
      orders: 10 * 60 * 1000, // 10 minutos
      sales: 15 * 60 * 1000, // 15 minutos

      // Dados de conta (raramente mudam)
      account: 30 * 60 * 1000, // 30 minutos
      auth: 20 * 60 * 1000, // 20 minutos
      user: 25 * 60 * 1000, // 25 minutos

      // Analytics e métricas
      analytics: 20 * 60 * 1000, // 20 minutos
      metrics: 15 * 60 * 1000, // 15 minutos

      // Dados de configuração
      categories: 24 * 60 * 60 * 1000, // 24 horas
      fees: 12 * 60 * 60 * 1000, // 12 horas

      // Fallback
      default: 5 * 60 * 1000, // 5 minutos
    };

    let ttl = baseTTL[dataType] || baseTTL["default"];

    // Ajustes baseados no contexto
    if (context) {
      if (context.includes("realtime") || context.includes("live")) {
        ttl = Math.min(ttl, 60 * 1000); // Máximo 1 minuto para dados em tempo real
      }
      if (context.includes("historical") || context.includes("90d")) {
        ttl = Math.max(ttl, 30 * 60 * 1000); // Mínimo 30 minutos para dados históricos
      }
      if (context.includes("listing") || context.includes("products")) {
        ttl = Math.min(ttl, 3 * 60 * 1000); // Máximo 3 minutos para listagens
      }
    }

    return ttl;
  }

  set<T>(
    key: string,
    data: T,
    dataType: string = "default",
    context?: string
  ): void {
    const ttlMs = this.getSmartTTL(dataType, context);

    // Remover items expirados se o cache estiver cheio
    if (this.cache.size >= this.maxSize) {
      this.cleanup();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
      dataType,
      context,
    });

    console.log(
      `[CACHE] Set: ${key} (TTL: ${Math.round(
        ttlMs / 1000
      )}s, Type: ${dataType})`
    );
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key) as CacheItem<T> | undefined;

    if (!item) {
      this.missCount++;
      console.log(`[CACHE] Miss: ${key}`);
      return null;
    }

    // Verificar se expirou
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      this.missCount++;
      console.log(`[CACHE] Expired: ${key}`);
      return null;
    }

    this.hitCount++;
    console.log(
      `[CACHE] Hit: ${key} (age: ${Math.round(
        (Date.now() - item.timestamp) / 1000
      )}s)`
    );
    return item.data;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
      }
    }

    // Se ainda estiver cheio, remover os mais antigos
    if (this.cache.size >= this.maxSize) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

      // Remover os 20% mais antigos
      const toRemove = Math.floor(this.maxSize * 0.2);
      for (let i = 0; i < toRemove && i < entries.length; i++) {
        this.cache.delete(entries[i][0]);
      }
    }
  }

  // ✅ MELHORIA: Estatísticas detalhadas do cache
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    hits: number;
    misses: number;
    efficiency: string;
  } {
    const total = this.hitCount + this.missCount;
    const hitRate = total > 0 ? (this.hitCount / total) * 100 : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
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

  // ✅ NOVO: Método para invalidar cache por padrão
  invalidatePattern(pattern: string): number {
    let deleted = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        deleted++;
      }
    }
    console.log(
      `[CACHE] Invalidated ${deleted} keys matching pattern: ${pattern}`
    );
    return deleted;
  }

  // ✅ NOVO: Cache distribuído - namespace por usuário
  private getUserKey(userId: string, baseKey: string): string {
    return `user:${userId}:${baseKey}`;
  }

  setForUser<T>(
    userId: string,
    key: string,
    data: T,
    dataType: string = "default",
    context?: string
  ): void {
    const userKey = this.getUserKey(userId, key);
    this.set(userKey, data, dataType, context);
  }

  getForUser<T>(userId: string, key: string): T | null {
    const userKey = this.getUserKey(userId, key);
    return this.get<T>(userKey);
  }

  deleteForUser(userId: string, key: string): void {
    const userKey = this.getUserKey(userId, key);
    this.delete(userKey);
  }

  // ✅ NOVO: Invalidar todo cache de um usuário
  invalidateUser(userId: string): number {
    return this.invalidatePattern(`user:${userId}:.*`);
  }

  // ✅ NOVO: Estatísticas por usuário
  getUserStats(userId: string): {
    entries: number;
    memoryUsageKB: number;
    oldestEntry?: string;
    newestEntry?: string;
  } {
    const userPattern = new RegExp(`^user:${userId}:.*`);
    const userEntries = new Map();

    for (const [key, entry] of this.cache.entries()) {
      if (userPattern.test(key)) {
        userEntries.set(key, entry);
      }
    }

    if (userEntries.size === 0) {
      return { entries: 0, memoryUsageKB: 0 };
    }

    // Encontrar entrada mais antiga e mais nova
    let oldest = { key: "", timestamp: Date.now() };
    let newest = { key: "", timestamp: 0 };

    for (const [key, entry] of userEntries.entries()) {
      if (entry.timestamp < oldest.timestamp) {
        oldest = { key, timestamp: entry.timestamp };
      }
      if (entry.timestamp > newest.timestamp) {
        newest = { key, timestamp: entry.timestamp };
      }
    }

    const memoryUsageKB = Math.round(
      JSON.stringify([...userEntries.values()]).length / 1024
    );

    return {
      entries: userEntries.size,
      memoryUsageKB,
      oldestEntry: oldest.key,
      newestEntry: newest.key,
    };
  }

  cleanupUser(userId: string, maxAge?: number): number {
    const userPattern = new RegExp(`^user:${userId}:.*`);
    const keysToDelete = [];
    const now = Date.now();
    const maxAgeMs = maxAge || 24 * 60 * 60 * 1000;

    for (const [key, entry] of this.cache.entries()) {
      if (userPattern.test(key)) {
        if (now - entry.timestamp > maxAgeMs) {
          keysToDelete.push(key);
        }
      }
    }

    keysToDelete.forEach((key) => this.cache.delete(key));

    if (keysToDelete.length > 0) {
      console.log(
        `[CACHE] Cleaned ${keysToDelete.length} old entries for user ${userId}`
      );
    }

    return keysToDelete.length;
  }
}

// Cache global inteligente para as APIs do ML
export const mlCache = new IntelligentCache();

// Função helper para criar chaves de cache
export function createCacheKey(...parts: (string | number)[]): string {
  return parts.join(":");
}

// ✅ NOVO: Função para obter estatísticas de cache por usuário
export function getUserCacheStats(userId: string) {
  return mlCache.getUserStats(userId);
}

// ✅ NOVO: Função para invalidar cache quando usuário faz logout
export function invalidateUserSession(userId: string): number {
  console.log(`[CACHE] Invalidating session cache for user: ${userId}`);
  return mlCache.invalidateUser(userId);
}

// ✅ NOVO: Função helper para cache por usuário
export async function withUserCache<T>(
  userId: string,
  key: string,
  fetcher: () => Promise<T>,
  dataType: string = "default",
  context?: string
): Promise<T> {
  // Tentar buscar do cache do usuário
  const cached = mlCache.getForUser<T>(userId, key);
  if (cached !== null) {
    return cached;
  }

  // Buscar dados e cachear para o usuário
  console.log(`[CACHE] Fetching for user ${userId}: ${key}`);
  const data = await fetcher();
  mlCache.setForUser(userId, key, data, dataType, context);

  return data;
}

// Função helper para cache com fallback
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  dataType: string = "default",
  context?: string
): Promise<T> {
  // Tentar buscar do cache
  const cached = mlCache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  const data = await fetcher();
  mlCache.set(key, data, dataType, context);
  return data;
}
