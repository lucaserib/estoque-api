import { CanalVenda } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { enfileirarPeriodo, enfileirarIncremental, executarFila } from "./fila";
import { ingerirGastosAdsDoDia } from "./ingestaoAds";
import { ingerirCobrancasDoMes } from "./ingestaoCobrancas";
import { inicioDoDia, fimDoDia } from "../dominio/periodo";

export type ModoSincronizacao = "INCREMENTAL" | "PERIODO" | "BACKFILL";

export interface ParametrosSincronizacao {
  modo: ModoSincronizacao;
  desde?: Date;
  ate?: Date;
}

export interface ResultadoSincronizacao {
  status: "CONCLUIDO" | "EM_ANDAMENTO";
  processados: number;
  erros: number;
  proximoPasso: "CONTINUAR" | null;
}

const MINUTOS_TRAVA_EXPIRADA = 2;

function mesReferenciaDe(data: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).format(data);
}

function mesesEntre(desde: Date, ate: Date): string[] {
  const meses: string[] = [];
  let cursor = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), 1));
  const fim = new Date(Date.UTC(ate.getUTCFullYear(), ate.getUTCMonth(), 1));
  while (cursor <= fim) {
    meses.push(mesReferenciaDe(cursor));
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return meses;
}

export async function obterTravaAtiva(userId: string, canal: CanalVenda) {
  const limite = new Date(Date.now() - MINUTOS_TRAVA_EXPIRADA * 60 * 1000);
  return prisma.sincronizacaoFinanceira.findFirst({
    where: {
      userId,
      canal,
      status: "EM_ANDAMENTO",
      iniciadoEm: { gte: limite },
    },
    orderBy: { iniciadoEm: "desc" },
  });
}

const DIAS_PADRAO_INCREMENTAL = 2;

export async function sincronizarFinanceiro(
  accountId: string,
  parametros: ParametrosSincronizacao
): Promise<ResultadoSincronizacao> {
  const conta = await prisma.mercadoLivreAccount.findUniqueOrThrow({
    where: { id: accountId },
    select: { userId: true },
  });
  const canal = CanalVenda.MERCADO_LIVRE;

  const registro = await prisma.sincronizacaoFinanceira.create({
    data: { userId: conta.userId, canal, tipo: parametros.modo, status: "EM_ANDAMENTO" },
  });

  try {
    const ate = parametros.ate ?? new Date();
    const desde =
      parametros.desde ??
      (parametros.modo === "INCREMENTAL"
        ? new Date(ate.getTime() - DIAS_PADRAO_INCREMENTAL * 24 * 60 * 60 * 1000)
        : ate);

    if (parametros.modo === "INCREMENTAL") {
      await enfileirarIncremental(accountId, 10);
    } else {
      await enfileirarPeriodo(accountId, desde, ate, parametros.modo === "BACKFILL" ? 20 : 10);
    }

    const resultadoFila = await executarFila(conta.userId, accountId);
    const processados = resultadoFila.processados;
    const status: "CONCLUIDO" | "EM_ANDAMENTO" =
      resultadoFila.status === "EM_ANDAMENTO" ? "EM_ANDAMENTO" : "CONCLUIDO";

    let erros = resultadoFila.status === "ERRO" ? 1 : 0;

    try {
      let cursorDia = inicioDoDia(desde);
      const fimPeriodo = fimDoDia(ate);
      while (cursorDia <= fimPeriodo) {
        await ingerirGastosAdsDoDia(accountId, cursorDia);
        cursorDia = new Date(fimDoDia(cursorDia).getTime() + 1);
      }
    } catch (erro) {
      erros++;
      console.error("[ORQUESTRADOR_FINANCEIRO] Erro ao ingerir ads:", erro);
    }

    for (const mesReferencia of mesesEntre(desde, ate)) {
      try {
        await ingerirCobrancasDoMes(accountId, mesReferencia);
      } catch (erro) {
        erros++;
        console.error("[ORQUESTRADOR_FINANCEIRO] Erro ao ingerir cobranças:", erro);
      }
    }

    await prisma.sincronizacaoFinanceira.update({
      where: { id: registro.id },
      data: {
        status: status === "CONCLUIDO" ? "CONCLUIDO" : "EM_ANDAMENTO",
        concluidoEm: status === "CONCLUIDO" ? new Date() : null,
        processados,
      },
    });

    return {
      status,
      processados,
      erros,
      proximoPasso: status === "EM_ANDAMENTO" ? "CONTINUAR" : null,
    };
  } catch (erro) {
    await prisma.sincronizacaoFinanceira.update({
      where: { id: registro.id },
      data: {
        status: "ERRO",
        erro: erro instanceof Error ? erro.message : "Erro desconhecido",
      },
    });
    throw erro;
  }
}
