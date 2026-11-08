import { CanalVenda } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { MLOrder } from "@/types/mercadolivre";
import { obterAdaptador } from "../canais/registro";
import { mapearPedido } from "../canais/mercadoLivre/mapeador";
import type { ContaCanal } from "../canais/tipos";
import { invalidarCacheFinanceiro } from "../relatorios/cache";
import { emParalelo } from "./paralelo";
import {
  mensagemDeErro,
  obterConfigIngestao,
  persistirVendaNormalizada,
  registrarErroPedido,
  resolverErroPedido,
} from "./sincronizador";

const CONCORRENCIA_PADRAO = 5;

export interface ResultadoLote {
  recebidos: number;
  gravados: number;
  semMudanca: number;
  naoRelevantes: number;
  erros: number;
}

export interface OpcoesLote {
  forcar?: boolean;
  concorrencia?: number;
  etapa?: string;
}

export async function ingerirPedidosEmLote(
  contaCanal: ContaCanal,
  pedidosBrutos: MLOrder[],
  opcoes: OpcoesLote = {}
): Promise<ResultadoLote> {
  const resultado: ResultadoLote = {
    recebidos: pedidosBrutos.length,
    gravados: 0,
    semMudanca: 0,
    naoRelevantes: 0,
    erros: 0,
  };
  if (pedidosBrutos.length === 0) return resultado;

  const adaptador = obterAdaptador(CanalVenda.MERCADO_LIVRE);
  const config = await obterConfigIngestao(contaCanal.userId);
  const ids = [...new Set(pedidosBrutos.map((p) => String(p.id)))];
  const existentes = await prisma.vendaCanal.findMany({
    where: { userId: contaCanal.userId, canal: adaptador.canal, pedidoExternoId: { in: ids } },
    include: { itens: true },
  });
  const existentePorPedido = new Map(existentes.map((v) => [v.pedidoExternoId, v]));
  const etapa = opcoes.etapa ?? "LOTE";

  await emParalelo(pedidosBrutos, opcoes.concorrencia ?? CONCORRENCIA_PADRAO, async (pedidoBruto) => {
    const pedidoExternoId = String(pedidoBruto.id);
    try {
      const normalizado = mapearPedido(pedidoBruto, null);
      if (!normalizado) {
        resultado.naoRelevantes++;
        return;
      }

      const existente = existentePorPedido.get(pedidoExternoId) ?? null;
      if (
        !opcoes.forcar &&
        existente &&
        existente.atualizadoNoCanalEm.getTime() === normalizado.atualizadoNoCanalEm.getTime() &&
        existente.status === normalizado.status
      ) {
        resultado.semMudanca++;
        return;
      }

      await persistirVendaNormalizada(contaCanal, adaptador, normalizado, {
        modo: "RAPIDO",
        config,
        vendaExistente: existente,
      });
      await resolverErroPedido(contaCanal.userId, adaptador.canal, pedidoExternoId);
      resultado.gravados++;
    } catch (erro) {
      resultado.erros++;
      await registrarErroPedido(contaCanal.userId, adaptador.canal, pedidoExternoId, etapa, mensagemDeErro(erro));
    }
  });

  if (resultado.gravados > 0) await invalidarCacheFinanceiro(contaCanal.userId);
  return resultado;
}
