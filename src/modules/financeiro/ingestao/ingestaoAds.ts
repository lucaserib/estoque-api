import { CanalVenda, StatusVendaCanal } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { obterAdaptador } from "../canais/registro";
import type { ContaCanal, GastoAdsNormalizado } from "../canais/tipos";
import { calcularMargemContribuicao } from "../dominio/formulas";
import { ratear } from "../dominio/dinheiro";
import { inicioDoDia, fimDoDia } from "../dominio/periodo";
import { atualizarResumoDoDia } from "./sincronizador";
import { vincularProdutoPorAnuncio } from "./vinculo";

function statusZeraQuantidade(status: StatusVendaCanal): boolean {
  return status === StatusVendaCanal.CANCELADA || status === StatusVendaCanal.DEVOLVIDA;
}

async function persistirGastoAds(
  contaCanal: ContaCanal,
  canal: CanalVenda,
  dia: Date,
  gasto: GastoAdsNormalizado
): Promise<void> {
  const produtoId = gasto.anuncioExternoId
    ? await vincularProdutoPorAnuncio(contaCanal.contaCanalId, gasto.anuncioExternoId)
    : null;

  const existente = await prisma.gastoAdsCanal.findFirst({
    where: {
      userId: contaCanal.userId,
      canal,
      dia,
      campanhaExternaId: gasto.campanhaExternaId,
      anuncioExternoId: gasto.anuncioExternoId,
    },
    select: { id: true },
  });

  const dadosComuns = {
    custo: gasto.custo,
    cliques: gasto.cliques,
    impressoes: gasto.impressoes,
    vendasAtribuidas: gasto.vendasAtribuidas,
    receitaAtribuida: gasto.receitaAtribuida,
    produtoId,
  };

  if (existente) {
    await prisma.gastoAdsCanal.update({ where: { id: existente.id }, data: dadosComuns });
  } else {
    await prisma.gastoAdsCanal.create({
      data: {
        userId: contaCanal.userId,
        canal,
        contaCanalId: contaCanal.contaCanalId,
        dia,
        campanhaExternaId: gasto.campanhaExternaId,
        anuncioExternoId: gasto.anuncioExternoId,
        ...dadosComuns,
      },
    });
  }
}

/**
 * Recalcula do zero o ads de cada item tocado pelos anúncios com gasto
 * nesse dia — nunca incrementa (reprocessar o mesmo dia tem que dar o mesmo
 * resultado). Cada anúncio rateia seu próprio custo só entre os itens dele
 * no dia (proporcional ao faturamento); um pedido com itens de anúncios
 * diferentes recebe a soma de cada parte, não um rateio único do total.
 */
async function ratearAdsDoDiaEntreVendas(
  userId: string,
  canal: CanalVenda,
  dia: Date
): Promise<void> {
  const fimDia = fimDoDia(dia);

  const gastos = await prisma.gastoAdsCanal.findMany({
    where: { userId, canal, dia },
    select: { anuncioExternoId: true, custo: true },
  });
  const anuncios = gastos.filter(
    (g): g is { anuncioExternoId: string; custo: number } => g.anuncioExternoId !== null
  );
  if (anuncios.length === 0) return;

  const itens = await prisma.vendaCanalItem.findMany({
    where: {
      anuncioExternoId: { in: anuncios.map((a) => a.anuncioExternoId) },
      venda: { userId, canal, dataVenda: { gte: dia, lte: fimDia } },
    },
    select: { id: true, vendaId: true, anuncioExternoId: true, precoUnitario: true, quantidade: true },
  });

  const adsPorItemId = new Map<string, number>();
  for (const { anuncioExternoId, custo } of anuncios) {
    const itensDoAnuncio = itens.filter((i) => i.anuncioExternoId === anuncioExternoId);
    if (itensDoAnuncio.length === 0) continue; // ads sem venda no dia: só fica em GastoAdsCanal

    const pesos = itensDoAnuncio.map((i) => i.precoUnitario * i.quantidade);
    const partes = ratear(custo, pesos);
    itensDoAnuncio.forEach((item, i) => adsPorItemId.set(item.id, partes[i]));
  }

  const vendaIdsAfetados = [...new Set(itens.filter((i) => adsPorItemId.has(i.id)).map((i) => i.vendaId))];
  for (const vendaId of vendaIdsAfetados) {
    await aplicarAdsNaVenda(vendaId, adsPorItemId);
  }
}

async function aplicarAdsNaVenda(
  vendaId: string,
  adsPorItemId: Map<string, number>
): Promise<void> {
  const venda = await prisma.vendaCanal.findUniqueOrThrow({
    where: { id: vendaId },
    include: { itens: true },
  });
  const zerar = statusZeraQuantidade(venda.status);

  let novoAdsAtribuido = 0;
  const margensPorItem: Array<number | null> = [];

  for (const item of venda.itens) {
    const adsRateado = adsPorItemId.get(item.id) ?? item.adsRateado;
    novoAdsAtribuido += adsRateado;

    const temTudo = item.custoUnitario != null && item.freteRateado != null;
    margensPorItem.push(
      temTudo
        ? calcularMargemContribuicao({
            faturamentoBruto: item.precoUnitario * (zerar ? 0 : item.quantidade),
            descontoVendedor: item.descontoRateado,
            imposto: item.impostoRateado,
            tarifa: item.tarifaVenda,
            frete: item.freteRateado as number,
            ads: adsRateado,
            cmv: item.custoUnitario as number,
          })
        : null
    );
  }

  const margemTotal = venda.completo
    ? margensPorItem.reduce<number>((soma, m) => soma + (m ?? 0), 0)
    : null;

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < venda.itens.length; i++) {
      const item = venda.itens[i];
      await tx.vendaCanalItem.update({
        where: { id: item.id },
        data: {
          adsRateado: adsPorItemId.get(item.id) ?? item.adsRateado,
          margemContribuicao: margensPorItem[i],
        },
      });
    }
    await tx.vendaCanal.update({
      where: { id: vendaId },
      data: { adsAtribuido: novoAdsAtribuido, margemContribuicao: margemTotal },
    });
  });

  await atualizarResumoDoDia(venda.userId, venda.canal, venda.dataVenda);
}

export async function ingerirGastosAdsDoDia(
  accountId: string,
  algumInstanteDoDia: Date
): Promise<{ processados: number }> {
  const conta = await prisma.mercadoLivreAccount.findUniqueOrThrow({
    where: { id: accountId },
    select: { userId: true },
  });
  const contaCanal: ContaCanal = { contaCanalId: accountId, userId: conta.userId };
  const adaptador = obterAdaptador(CanalVenda.MERCADO_LIVRE);

  if (!adaptador.listarGastosAds) return { processados: 0 };

  const dia = inicioDoDia(algumInstanteDoDia);
  const gastos = await adaptador.listarGastosAds(contaCanal, dia);

  for (const gasto of gastos) {
    await persistirGastoAds(contaCanal, adaptador.canal, dia, gasto);
  }

  if (gastos.length > 0) {
    await ratearAdsDoDiaEntreVendas(conta.userId, adaptador.canal, dia);
    await atualizarResumoDoDia(conta.userId, adaptador.canal, dia);
  }

  return { processados: gastos.length };
}
