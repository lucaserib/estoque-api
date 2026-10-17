import { CanalVenda } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { continuarBackfill, reprocessarUltimosDias } from "./sincronizador";
import { ingerirGastosAdsDoDia } from "./ingestaoAds";
import { ingerirCobrancasDoMes } from "./ingestaoCobrancas";

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

const MINUTOS_TRAVA_EXPIRADA = 10;

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

export async function sincronizarFinanceiro(
  accountId: string,
  parametros: ParametrosSincronizacao
): Promise<ResultadoSincronizacao> {
  const conta = await prisma.mercadoLivreAccount.findUniqueOrThrow({
    where: { id: accountId },
    select: { userId: true },
  });
  const canal = CanalVenda.MERCADO_LIVRE;

  const registro =
    parametros.modo === "BACKFILL"
      ? null
      : await prisma.sincronizacaoFinanceira.create({
          data: { userId: conta.userId, canal, tipo: parametros.modo, status: "EM_ANDAMENTO" },
        });

  try {
    let processados = 0;
    let status: "CONCLUIDO" | "EM_ANDAMENTO" = "CONCLUIDO";

    if (parametros.modo === "BACKFILL") {
      const resultado = await continuarBackfill(accountId);
      processados = resultado.processados;
      status = resultado.status;
    } else if (parametros.modo === "PERIODO" && parametros.desde) {
      const dias = Math.max(
        1,
        Math.ceil((Date.now() - parametros.desde.getTime()) / (24 * 60 * 60 * 1000))
      );
      const resultado = await reprocessarUltimosDias(accountId, dias);
      processados = resultado.processados;
    } else {
      const resultado = await reprocessarUltimosDias(accountId);
      processados = resultado.processados;
    }

    let erros = 0;
    const ate = parametros.ate ?? new Date();
    const desde = parametros.desde ?? ate;

    try {
      await ingerirGastosAdsDoDia(accountId, new Date(ate.getTime() - 24 * 60 * 60 * 1000));
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

    if (registro) {
      await prisma.sincronizacaoFinanceira.update({
        where: { id: registro.id },
        data: { status: "CONCLUIDO", concluidoEm: new Date(), processados },
      });
    }

    return {
      status,
      processados,
      erros,
      proximoPasso: status === "EM_ANDAMENTO" ? "CONTINUAR" : null,
    };
  } catch (erro) {
    if (registro) {
      await prisma.sincronizacaoFinanceira.update({
        where: { id: registro.id },
        data: {
          status: "ERRO",
          erro: erro instanceof Error ? erro.message : "Erro desconhecido",
        },
      });
    }
    throw erro;
  }
}
