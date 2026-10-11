import { mlCache, withUserCache } from "@/lib/cache";

const PREFIXO = "financeiro-relatorios";

/**
 * Cache curto (60s) por conta para os relatórios do financeiro — reaproveita
 * o mesmo mecanismo já usado por produtos/pendências (src/lib/cache.ts), não
 * um novo. Invalidado explicitamente nos pontos de escrita de maior volume
 * (ingestão de vendas/ads/cobranças, CRUD de lançamentos); as escritas mais
 * raras (recorrência, cartão, parcelamento, conta a pagar de pedido de
 * compra) contam com a expiração natural de 60s em vez de invalidação
 * explícita — risco aceito, documentado em docs/AUDITORIA-CICLO-7.md.
 */
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
