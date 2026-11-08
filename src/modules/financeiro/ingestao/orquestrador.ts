import { CanalVenda, TipoTarefaSincronizacao } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  enfileirarCobrancas,
  enfileirarIncremental,
  enfileirarPeriodo,
  enfileirarTarefa,
  executarFila,
  type ResultadoExecucaoFila,
} from "./fila";
import { inicioDoDia, fimDoDia } from "../dominio/periodo";

export type ModoSincronizacao = "INCREMENTAL" | "PERIODO" | "BACKFILL";

export interface ParametrosSincronizacao {
  modo: ModoSincronizacao;
  desde?: Date;
  ate?: Date;
  forcar?: boolean;
  orcamentoMs?: number;
}

export interface ResultadoSincronizacao {
  status: "CONCLUIDO" | "EM_ANDAMENTO";
  processados: number;
  erros: number;
  proximoPasso: "CONTINUAR" | null;
  fila: ResultadoExecucaoFila;
}

const DIAS_BACKFILL_PADRAO = 365;
const DIAS_ADS_INCREMENTAL = 2;
const DIAS_MAXIMOS_ADS = 31;

export async function sincronizarFinanceiro(
  accountId: string,
  parametros: ParametrosSincronizacao
): Promise<ResultadoSincronizacao> {
  const conta = await prisma.mercadoLivreAccount.findUniqueOrThrow({
    where: { id: accountId },
    select: { userId: true },
  });

  const agora = new Date();
  const ate = parametros.ate ?? agora;
  const desde =
    parametros.desde ??
    (parametros.modo === "BACKFILL"
      ? new Date(ate.getTime() - DIAS_BACKFILL_PADRAO * 24 * 60 * 60 * 1000)
      : new Date(ate.getTime() - DIAS_ADS_INCREMENTAL * 24 * 60 * 60 * 1000));

  if (parametros.modo === "INCREMENTAL") {
    await enfileirarIncremental(accountId, 30);
  } else {
    await enfileirarPeriodo(
      accountId,
      inicioDoDia(desde),
      fimDoDia(ate),
      parametros.modo === "BACKFILL" ? 20 : 25,
      parametros.forcar ?? false
    );
  }

  await enfileirarCobrancas(accountId, desde, ate, 5);
  await enfileirarTarefa({
    userId: conta.userId,
    canal: CanalVenda.MERCADO_LIVRE,
    contaCanalId: accountId,
    tipo: TipoTarefaSincronizacao.ADS,
    desde: inicioDoDia(
      new Date(Math.max(desde.getTime(), ate.getTime() - DIAS_MAXIMOS_ADS * 24 * 60 * 60 * 1000))
    ),
    ate: fimDoDia(ate),
    prioridade: 4,
  });

  const fila = await executarFila(conta.userId, accountId, parametros.orcamentoMs);
  const emAndamento = fila.status === "EM_ANDAMENTO" || fila.status === "OCUPADO";

  return {
    status: emAndamento ? "EM_ANDAMENTO" : "CONCLUIDO",
    processados: fila.processados + fila.vendasDetalhadas,
    erros: fila.status === "ERRO" ? 1 : 0,
    proximoPasso: emAndamento ? "CONTINUAR" : null,
    fila,
  };
}
