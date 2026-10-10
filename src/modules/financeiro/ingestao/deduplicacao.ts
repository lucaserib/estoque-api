import { CanalVenda } from "@prisma/client";

export interface OrigemPedido {
  canal: CanalVenda;
  pedidoExternoId: string;
}

/**
 * Se um canal (ex.: ERP) sabe que o pedido que está importando é só um
 * espelho de um pedido que já nasceu em outro canal (ex.: Mercado Livre),
 * ele declara essa origem — e a chave canônica usada para gravar/deduplicar
 * passa a ser a do canal original, não a do espelho. Hoje nenhum adaptador
 * declara origem (o ML é sempre a própria origem); o gancho existe para
 * quando pedidos do Bling/ERP passarem a ser importados.
 */
export function resolverOrigemCanonica(
  candidato: OrigemPedido,
  origemDeclarada?: OrigemPedido | null
): OrigemPedido {
  return origemDeclarada ?? candidato;
}

export function chaveCanonica(origem: OrigemPedido): string {
  return `${origem.canal}:${origem.pedidoExternoId}`;
}
