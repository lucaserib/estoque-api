import { mlCache, withUserCache } from "@/lib/cache";

const PREFIXO = "financeiro-relatorios";

export async function comCacheFinanceiro<T>(
  userId: string,
  chave: string,
  buscar: () => Promise<T>
): Promise<T> {
  return withUserCache(userId, `${PREFIXO}:${chave}`, buscar, "financeiro");
}

export async function invalidarCacheFinanceiro(userId: string): Promise<void> {
  await mlCache.invalidatePattern(`user:${userId}:${PREFIXO}:`);
}
