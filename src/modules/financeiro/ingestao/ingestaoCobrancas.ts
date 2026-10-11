import { CanalVenda } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { obterAdaptador } from "../canais/registro";
import type { ContaCanal } from "../canais/tipos";

export interface ResultadoIngestaoCobrancas {
  processadas: number;
  naoMapeadas: number;
}

/**
 * Cobranças com `coberturaPedido=true` (tarifa de venda, frete do pedido) já
 * entram na DRE pelo próprio VendaCanal — aqui só servem para conciliação
 * (Fase 4 item 3). As demais (armazenagem Full, ads quando a API de Ads
 * falhar, outras tarifas) são a própria fonte da DRE para esses valores.
 */
export async function ingerirCobrancasDoMes(
  accountId: string,
  mesReferencia: string
): Promise<ResultadoIngestaoCobrancas> {
  const conta = await prisma.mercadoLivreAccount.findUniqueOrThrow({
    where: { id: accountId },
    select: { userId: true },
  });
  const contaCanal: ContaCanal = { contaCanalId: accountId, userId: conta.userId };
  const adaptador = obterAdaptador(CanalVenda.MERCADO_LIVRE);

  if (!adaptador.listarCobrancas) return { processadas: 0, naoMapeadas: 0 };

  const cobrancas = await adaptador.listarCobrancas(contaCanal, mesReferencia);

  let naoMapeadas = 0;
  for (const cobranca of cobrancas) {
    await prisma.cobrancaCanal.upsert({
      where: {
        userId_canal_detalheExternoId: {
          userId: conta.userId,
          canal: adaptador.canal,
          detalheExternoId: cobranca.detalheExternoId,
        },
      },
      create: {
        userId: conta.userId,
        canal: adaptador.canal,
        contaCanalId: accountId,
        mesReferencia,
        detalheExternoId: cobranca.detalheExternoId,
        tipoExterno: cobranca.tipoExterno,
        tipoNormalizado: cobranca.tipoNormalizado,
        valor: cobranca.valor,
        pedidoExternoId: cobranca.pedidoExternoId,
        anuncioExternoId: cobranca.anuncioExternoId,
        data: cobranca.data,
        coberturaPedido: cobranca.coberturaPedido,
      },
      update: {
        tipoExterno: cobranca.tipoExterno,
        tipoNormalizado: cobranca.tipoNormalizado,
        valor: cobranca.valor,
        coberturaPedido: cobranca.coberturaPedido,
      },
    });

    if (cobranca.tipoNormalizado === "NAO_MAPEADO") naoMapeadas++;
  }

  return { processadas: cobrancas.length, naoMapeadas };
}
