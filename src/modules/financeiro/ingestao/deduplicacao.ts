import { CanalVenda } from "@prisma/client";

export interface OrigemPedido {
  canal: CanalVenda;
  pedidoExternoId: string;
}

export function resolverOrigemCanonica(
  candidato: OrigemPedido,
  origemDeclarada?: OrigemPedido | null
): OrigemPedido {
  return origemDeclarada ?? candidato;
}

export function chaveCanonica(origem: OrigemPedido): string {
  return `${origem.canal}:${origem.pedidoExternoId}`;
}
