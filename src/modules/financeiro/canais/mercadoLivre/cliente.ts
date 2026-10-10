import { CanalVenda, Confianca } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MercadoLivreService } from "@/services/mercadoLivreService";
import { fetchMlWithBackoff } from "@/lib/mlFetch";
import type {
  AdaptadorCanalFinanceiro,
  ContaCanal,
  CustoEnvioNormalizado,
  PaginaPedidos,
  VendaCanalNormalizada,
} from "../tipos";
import { mapearCustoEnvio, mapearPedido } from "./mapeador";

const BASE_URL = "https://api.mercadolibre.com";
const LIMITE_POR_PAGINA = 50;
const ML_MAX_OFFSET = 10000;

async function obterAccessTokenEMlUserId(
  contaCanalId: string
): Promise<{ accessToken: string; mlUserId: string }> {
  const [accessToken, conta] = await Promise.all([
    MercadoLivreService.getValidToken(contaCanalId),
    prisma.mercadoLivreAccount.findUniqueOrThrow({
      where: { id: contaCanalId },
      select: { mlUserId: true },
    }),
  ]);
  return { accessToken, mlUserId: conta.mlUserId };
}

async function buscarDiscounts(
  pedidoExternoId: string,
  accessToken: string
): Promise<unknown> {
  const resposta = await fetchMlWithBackoff(
    `${BASE_URL}/orders/${pedidoExternoId}/discounts`,
    { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } }
  );
  if (!resposta.ok) return null;
  return resposta.json();
}

export const adaptadorMercadoLivre: AdaptadorCanalFinanceiro = {
  canal: CanalVenda.MERCADO_LIVRE,

  async listarPedidosAlterados(
    conta: ContaCanal,
    desde: Date,
    ate: Date,
    cursor?: string | null
  ): Promise<PaginaPedidos> {
    const offset = cursor ? Number(cursor) : 0;
    const { accessToken, mlUserId } = await obterAccessTokenEMlUserId(
      conta.contaCanalId
    );

    const params = new URLSearchParams({
      seller: mlUserId,
      offset: String(offset),
      limit: String(LIMITE_POR_PAGINA),
      sort: "date_desc",
      "order.date_last_updated.from": desde.toISOString(),
      "order.date_last_updated.to": ate.toISOString(),
    });

    const resposta = await fetchMlWithBackoff(
      `${BASE_URL}/orders/search?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } }
    );

    if (!resposta.ok) {
      throw new Error(
        `Erro ao listar pedidos alterados do Mercado Livre: ${resposta.status}`
      );
    }

    const dados = (await resposta.json()) as {
      results: Array<{ id: string; last_updated?: string }>;
      paging: { total: number };
    };

    const proximoOffset = offset + LIMITE_POR_PAGINA;
    const tetoDisponivel = Math.min(dados.paging.total, ML_MAX_OFFSET);
    const temMais =
      dados.results.length === LIMITE_POR_PAGINA && proximoOffset < tetoDisponivel;

    return {
      pedidos: dados.results.map((r) => ({
        pedidoExternoId: r.id,
        atualizadoNoCanalEm: r.last_updated ? new Date(r.last_updated) : new Date(),
      })),
      cursor: temMais ? String(proximoOffset) : null,
      temMais,
    };
  },

  async obterPedido(
    conta: ContaCanal,
    pedidoExternoId: string
  ): Promise<VendaCanalNormalizada | null> {
    const { accessToken } = await obterAccessTokenEMlUserId(conta.contaCanalId);
    const [pedido, descontos] = await Promise.all([
      MercadoLivreService.getOrder(pedidoExternoId, accessToken),
      buscarDiscounts(pedidoExternoId, accessToken),
    ]);

    return mapearPedido(pedido, descontos);
  },

  async obterCustoEnvio(
    conta: ContaCanal,
    envioId: string
  ): Promise<CustoEnvioNormalizado> {
    const { accessToken } = await obterAccessTokenEMlUserId(conta.contaCanalId);
    const resposta = await fetchMlWithBackoff(
      `${BASE_URL}/shipments/${envioId}/costs`,
      { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } }
    );

    if (!resposta.ok) {
      return { valor: null, confianca: Confianca.ESTIMADO };
    }

    return mapearCustoEnvio(await resposta.json());
  },
};
