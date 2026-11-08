import { ArmazemTipo, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchMlWithBackoff } from "@/lib/mlFetch";
import { pickMlImageUrl } from "@/lib/imageUrl";
import { MercadoLivreService } from "@/services/mercadoLivreService";
import { obterPrecoAtualAnuncio } from "@/services/mercadoLivrePreco";
import { FULL_ARMAZEM_NOME } from "@/lib/estoque";
import type { MLItem } from "@/types/mercadolivre";

const BASE_URL = "https://api.mercadolibre.com";
const LIMITE_BUSCA = 100;

export interface ContaMl {
  id: string;
  userId: string;
  siteId: string;
  mlUserId: string;
}

export async function listarIdsAnunciosMl(accessToken: string, mlUserId: string): Promise<string[]> {
  const ids: string[] = [];
  const cabecalhos = { Authorization: `Bearer ${accessToken}`, Accept: "application/json" };

  const primeira = await fetchMlWithBackoff(
    `${BASE_URL}/users/${mlUserId}/items/search?limit=${LIMITE_BUSCA}&offset=0`,
    { headers: cabecalhos }
  );
  if (!primeira.ok) throw new Error(`Mercado Livre recusou a lista de anúncios (HTTP ${primeira.status})`);
  const dadosPrimeira = (await primeira.json()) as { results?: string[]; paging?: { total?: number } };
  ids.push(...(dadosPrimeira.results ?? []));
  const total = dadosPrimeira.paging?.total ?? ids.length;

  if (total <= 1000) {
    for (let offset = LIMITE_BUSCA; offset < total; offset += LIMITE_BUSCA) {
      const resposta = await fetchMlWithBackoff(
        `${BASE_URL}/users/${mlUserId}/items/search?limit=${LIMITE_BUSCA}&offset=${offset}`,
        { headers: cabecalhos }
      );
      if (!resposta.ok) throw new Error(`Mercado Livre recusou a lista de anúncios (HTTP ${resposta.status})`);
      const dados = (await resposta.json()) as { results?: string[] };
      ids.push(...(dados.results ?? []));
    }
    return [...new Set(ids)];
  }

  ids.length = 0;
  let scrollId: string | null = null;
  for (;;) {
    const params = new URLSearchParams({ search_type: "scan", limit: String(LIMITE_BUSCA) });
    if (scrollId) params.set("scroll_id", scrollId);
    const resposta = await fetchMlWithBackoff(`${BASE_URL}/users/${mlUserId}/items/search?${params.toString()}`, {
      headers: cabecalhos,
    });
    if (!resposta.ok) throw new Error(`Mercado Livre recusou a lista de anúncios (HTTP ${resposta.status})`);
    const dados = (await resposta.json()) as { results?: string[]; scroll_id?: string };
    const pagina = dados.results ?? [];
    if (pagina.length === 0) break;
    ids.push(...pagina);
    scrollId = dados.scroll_id ?? null;
    if (!scrollId) break;
  }
  return [...new Set(ids)];
}

async function montarDadosAnuncio(item: MLItem, accessToken: string, conta: ContaMl) {
  let precoAtual = Math.round(item.price * 100);
  let precoOriginal = item.original_price ? Math.round(item.original_price * 100) : null;
  let temPromocao = Boolean(precoOriginal && precoOriginal > precoAtual);

  const preco = await obterPrecoAtualAnuncio(item.id, accessToken);
  if (preco) {
    precoAtual = preco.precoAtual;
    precoOriginal = preco.temPromocao ? preco.precoOriginal : null;
    temPromocao = preco.temPromocao;
  }

  let mlTarifaVenda: number | null = null;
  let mlCustoFrete: number | null = null;
  let mlCustosAtualizadosEm: Date | null = null;
  if (item.status === "active") {
    const custos = await MercadoLivreService.fetchCustosAnuncio(item, accessToken, conta.siteId, conta.mlUserId);
    mlTarifaVenda = custos.mlTarifaVenda;
    mlCustoFrete = custos.mlCustoFrete;
    mlCustosAtualizadosEm = new Date();
  }

  let full: { disponivel: number; emTransito: number; indisponivel: number } | null = null;
  if (item.inventory_id) {
    full = await MercadoLivreService.getFulfillmentStock(item.inventory_id, accessToken);
  }

  const logistica = item.shipping?.logistic_type ?? null;
  return {
    mlTitle: item.title,
    mlSellerSku: MercadoLivreService.extractRealSku(item),
    mlPrice: precoAtual,
    mlOriginalPrice: precoOriginal,
    mlBasePrice: item.base_price ? Math.round(item.base_price * 100) : null,
    mlHasPromotion: temPromocao,
    mlPromotionDiscount:
      temPromocao && precoOriginal ? Math.round(((precoOriginal - precoAtual) / precoOriginal) * 100) : null,
    mlAvailableQuantity: item.available_quantity,
    mlSoldQuantity: item.sold_quantity || 0,
    mlStatus: item.status,
    mlCondition: item.condition,
    mlListingType: item.listing_type_id || "gold_special",
    mlPermalink: item.permalink,
    mlThumbnail: pickMlImageUrl(item),
    mlCategoryId: item.category_id,
    mlShippingMode: logistica || item.shipping?.mode || null,
    mlLastUpdated: new Date(item.last_updated || new Date()),
    lastSyncAt: new Date(),
    syncStatus: "synced",
    syncError: null,
    mlTarifaVenda,
    mlCustoFrete,
    mlCustosAtualizadosEm,
    mlLogisticType: logistica,
    mlInventoryId: item.inventory_id ?? null,
    mlFullDisponivel: full?.disponivel ?? null,
    mlFullEmTransito: full?.emTransito ?? null,
    mlFullIndisponivel: full?.indisponivel ?? null,
    mlFullAtualizadoEm: full ? new Date() : null,
  } satisfies Prisma.ProdutoMercadoLivreUpdateInput;
}

export type ResultadoAnuncio = "CRIADO" | "ATUALIZADO";

export async function sincronizarAnuncioMl(conta: ContaMl, accessToken: string, itemId: string): Promise<ResultadoAnuncio> {
  const item = await MercadoLivreService.getItem(itemId, accessToken);
  const dados = await montarDadosAnuncio(item, accessToken, conta);

  const existente = await prisma.produtoMercadoLivre.findFirst({
    where: { mlItemId: itemId, mercadoLivreAccountId: conta.id },
    select: { id: true },
  });
  if (existente) {
    await prisma.produtoMercadoLivre.update({ where: { id: existente.id }, data: dados });
    return "ATUALIZADO";
  }

  const sku = MercadoLivreService.extractRealSku(item);
  const produtoLocal = sku
    ? await prisma.produto.findFirst({ where: { sku, userId: conta.userId }, select: { id: true } })
    : null;

  await prisma.produtoMercadoLivre.create({
    data: {
      ...dados,
      produtoId: produtoLocal?.id ?? null,
      mercadoLivreAccountId: conta.id,
      mlItemId: itemId,
      syncStatus: produtoLocal ? "synced" : "pending_link",
    },
  });
  return "CRIADO";
}

export async function registrarErroAnuncio(contaId: string, itemId: string, mensagem: string): Promise<void> {
  await prisma.produtoMercadoLivre.updateMany({
    where: { mlItemId: itemId, mercadoLivreAccountId: contaId },
    data: { syncStatus: "error", syncError: mensagem.slice(0, 500), lastSyncAt: new Date() },
  });
}

export async function atualizarEstoqueFullDosAnuncios(userId: string, contaId: string): Promise<number> {
  const anunciosFull = await prisma.produtoMercadoLivre.findMany({
    where: { mercadoLivreAccountId: contaId, produtoId: { not: null }, mlLogisticType: "fulfillment" },
    select: { produtoId: true, mlFullDisponivel: true },
  });

  const porProduto = new Map<string, number>();
  for (const anuncio of anunciosFull) {
    if (!anuncio.produtoId || anuncio.mlFullDisponivel == null) continue;
    porProduto.set(anuncio.produtoId, (porProduto.get(anuncio.produtoId) ?? 0) + anuncio.mlFullDisponivel);
  }
  if (porProduto.size === 0) return 0;

  const existente = await prisma.armazem.findFirst({ where: { userId, nome: FULL_ARMAZEM_NOME } });
  const armazem =
    existente && existente.tipo !== ArmazemTipo.FULL_ML
      ? await prisma.armazem.update({ where: { id: existente.id }, data: { tipo: ArmazemTipo.FULL_ML } })
      : existente ?? (await prisma.armazem.create({ data: { nome: FULL_ARMAZEM_NOME, userId, tipo: ArmazemTipo.FULL_ML } }));

  let alterados = 0;
  for (const [produtoId, quantidade] of porProduto) {
    const atual = await prisma.estoque.findUnique({
      where: { produtoId_armazemId: { produtoId, armazemId: armazem.id } },
      select: { quantidade: true },
    });
    if (atual?.quantidade === quantidade) continue;
    await prisma.$transaction([
      prisma.estoque.upsert({
        where: { produtoId_armazemId: { produtoId, armazemId: armazem.id } },
        create: { produtoId, armazemId: armazem.id, quantidade },
        update: { quantidade },
      }),
      prisma.estoqueMovimentacao.create({
        data: {
          userId,
          produtoId,
          armazemId: armazem.id,
          quantidadeAnterior: atual?.quantidade ?? 0,
          quantidadeNova: quantidade,
          origem: "SINCRONIZACAO_FULL_ML",
        },
      }),
    ]);
    alterados++;
  }
  return alterados;
}
