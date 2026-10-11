import { CanalVenda, Confianca } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MercadoLivreService } from "@/services/mercadoLivreService";
import { fetchMlWithBackoff } from "@/lib/mlFetch";
import type {
  AdaptadorCanalFinanceiro,
  CobrancaNormalizada,
  ContaCanal,
  CustoEnvioNormalizado,
  GastoAdsNormalizado,
  PaginaPedidos,
  VendaCanalNormalizada,
} from "../tipos";
import { mapearCustoEnvio, mapearPedido } from "./mapeador";
import { mapearGastoAds, type GastoAdsBruto } from "./mapeadorAds";
import { mapearCobranca, type CobrancaBruta } from "./mapeadorCobrancas";

const BASE_URL = "https://api.mercadolibre.com";
const LIMITE_POR_PAGINA = 50;
const ML_MAX_OFFSET = 10000;
const LIMITE_COBRANCAS_POR_PAGINA = 1000;

function formatarDataCurtaSp(data: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(data);
}

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

  /**
   * Endpoint de melhor esforço (Product Ads) — menor confiança de todo o
   * adaptador, nem o caminho da URL foi confirmado contra uma conta real.
   * Qualquer falha devolve lista vazia em vez de derrubar a ingestão do dia.
   */
  async listarGastosAds(conta: ContaCanal, dia: Date): Promise<GastoAdsNormalizado[]> {
    try {
      const { accessToken } = await obterAccessTokenEMlUserId(conta.contaCanalId);
      const dataStr = formatarDataCurtaSp(dia);

      const respostaAnunciante = await fetchMlWithBackoff(
        `${BASE_URL}/advertising/advertisers?product_id=PADS`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Api-Version": "2",
            Accept: "application/json",
          },
        }
      );
      if (!respostaAnunciante.ok) return [];

      const anunciantes = (await respostaAnunciante.json()) as {
        advertisers?: Array<{ advertiser_id: number | string }>;
      };
      const advertiserId = anunciantes.advertisers?.[0]?.advertiser_id;
      if (advertiserId == null) return [];

      const params = new URLSearchParams({
        advertiser_id: String(advertiserId),
        date_from: dataStr,
        date_to: dataStr,
      });
      const resposta = await fetchMlWithBackoff(
        `${BASE_URL}/advertising/product_ads/ads?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Api-Version": "2",
            Accept: "application/json",
          },
        }
      );
      if (!resposta.ok) return [];

      const dados = (await resposta.json()) as {
        ads?: GastoAdsBruto[];
        results?: GastoAdsBruto[];
      };
      return (dados.ads ?? dados.results ?? []).map(mapearGastoAds);
    } catch (erro) {
      console.error("[ADS_ML] Erro ao buscar gastos de ads:", erro);
      return [];
    }
  },

  async listarCobrancas(
    conta: ContaCanal,
    mesReferencia: string
  ): Promise<CobrancaNormalizada[]> {
    const cobrancas: CobrancaNormalizada[] = [];

    try {
      const { accessToken } = await obterAccessTokenEMlUserId(conta.contaCanalId);
      const chavePeriodo = `${mesReferencia}-01`;
      let fromId: string | undefined;

      do {
        const params = new URLSearchParams({
          document_type: "BILL",
          limit: String(LIMITE_COBRANCAS_POR_PAGINA),
        });
        if (fromId) params.set("from_id", fromId);

        const resposta = await fetchMlWithBackoff(
          `${BASE_URL}/billing/integration/periods/key/${chavePeriodo}/group/ML/details?${params.toString()}`,
          { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } }
        );
        if (!resposta.ok) break;

        const dados = (await resposta.json()) as {
          results?: CobrancaBruta[];
          paging?: { next_from_id?: string };
        };
        cobrancas.push(...(dados.results ?? []).map(mapearCobranca));
        fromId = dados.paging?.next_from_id;
      } while (fromId);
    } catch (erro) {
      console.error("[COBRANCAS_ML] Erro ao buscar cobranças:", erro);
    }

    return cobrancas;
  },
};
