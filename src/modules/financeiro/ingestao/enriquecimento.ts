import { prisma } from "@/lib/prisma";
import { invalidarCacheFinanceiro } from "../relatorios/cache";
import { emParalelo } from "./paralelo";
import { ingerirPedidoMercadoLivre, mensagemDeErro } from "./sincronizador";

export const TENTATIVAS_MAXIMAS_ENRIQUECIMENTO = 5;
const CONCORRENCIA_PADRAO = 4;
const MARGEM_SEGURANCA_MS = 6000;

export function filtroAguardandoDetalhes(contaCanalId: string) {
  return {
    contaCanalId,
    enriquecidoEm: null,
    enriquecimentoTentativas: { lt: TENTATIVAS_MAXIMAS_ENRIQUECIMENTO },
  };
}

export async function contarVendasAguardandoDetalhes(contaCanalId: string): Promise<number> {
  return prisma.vendaCanal.count({ where: filtroAguardandoDetalhes(contaCanalId) });
}

export interface ResultadoEnriquecimento {
  processados: number;
  falhas: number;
  restantes: number;
}

/**
 * Etapa 2 da sincronização: completa cada venda gravada pela etapa 1 com o
 * pagamento do Mercado Pago (tarifa real, frete real, retenções, líquido e
 * liberação) e a logística do envio. Vai das vendas mais recentes para as
 * mais antigas, respeita o orçamento de tempo da requisição e desiste de uma
 * venda depois de 5 falhas (fica marcada com o motivo, sem travar a fila).
 */
export async function enriquecerVendasPendentes(
  contaCanalId: string,
  userId: string,
  orcamentoMs: number,
  concorrencia = CONCORRENCIA_PADRAO
): Promise<ResultadoEnriquecimento> {
  const inicio = Date.now();
  let processados = 0;
  let falhas = 0;

  while (Date.now() - inicio < orcamentoMs - MARGEM_SEGURANCA_MS) {
    const lote = await prisma.vendaCanal.findMany({
      where: filtroAguardandoDetalhes(contaCanalId),
      orderBy: { dataVenda: "desc" },
      take: concorrencia * 2,
      select: { id: true, pedidoExternoId: true },
    });
    if (lote.length === 0) break;

    await emParalelo(lote, concorrencia, async (venda) => {
      try {
        const resultado = await ingerirPedidoMercadoLivre(contaCanalId, venda.pedidoExternoId);
        if (!resultado.ingerido) {
          await prisma.vendaCanal.update({
            where: { id: venda.id },
            data: { enriquecidoEm: new Date(), enriquecimentoErro: resultado.motivo ?? null },
          });
        }
        processados++;
      } catch (erro) {
        falhas++;
        await prisma.vendaCanal.update({
          where: { id: venda.id },
          data: {
            enriquecimentoTentativas: { increment: 1 },
            enriquecimentoErro: mensagemDeErro(erro).slice(0, 500),
          },
        });
      }
    });
  }

  if (processados > 0) await invalidarCacheFinanceiro(userId);
  const restantes = await contarVendasAguardandoDetalhes(contaCanalId);
  return { processados, falhas, restantes };
}
