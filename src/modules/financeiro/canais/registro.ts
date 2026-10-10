import { CanalVenda } from "@prisma/client";
import type { AdaptadorCanalFinanceiro } from "./tipos";
import { adaptadorMercadoLivre } from "./mercadoLivre/cliente";

/**
 * Um canal novo (Shopee, Amazon, Magalu…) entra aqui, implementando
 * AdaptadorCanalFinanceiro — nada na ingestão ou no domínio muda.
 */
export const ADAPTADORES_POR_CANAL: Partial<
  Record<CanalVenda, AdaptadorCanalFinanceiro>
> = {
  [CanalVenda.MERCADO_LIVRE]: adaptadorMercadoLivre,
};

export function obterAdaptador(canal: CanalVenda): AdaptadorCanalFinanceiro {
  const adaptador = ADAPTADORES_POR_CANAL[canal];
  if (!adaptador) {
    throw new Error(`Nenhum adaptador financeiro registrado para o canal ${canal}`);
  }
  return adaptador;
}
