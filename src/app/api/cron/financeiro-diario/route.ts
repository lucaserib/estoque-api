import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reprocessarErrosPendentes } from "@/modules/financeiro/ingestao/sincronizador";
import { enfileirarIncremental, executarFila } from "@/modules/financeiro/ingestao/fila";
import { ingerirGastosAdsDoDia } from "@/modules/financeiro/ingestao/ingestaoAds";
import { ingerirCobrancasDoMes } from "@/modules/financeiro/ingestao/ingestaoCobrancas";
import { conferirMes, importarFaltantes } from "@/modules/financeiro/relatorios/conferencia";
import { competenciaDe } from "@/modules/financeiro/dominio/periodo";
import { gerarLancamentosDeTodasAsRecorrencias } from "@/modules/financeiro/lancamentos/recorrencias";
import { gerarAlertasFinanceiros } from "@/modules/financeiro/alertas";

export const maxDuration = 60;

const ORCAMENTO_FILA_MS = 8000;
const RODADAS_MAXIMAS_FILA = 3;

function mesReferenciaDe(data: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).format(data);
}

function competenciaAnteriorA(competencia: { ano: number; mes: number }) {
  return competencia.mes === 1
    ? { ano: competencia.ano - 1, mes: 12 }
    : { ano: competencia.ano, mes: competencia.mes - 1 };
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const contasAtivas = await prisma.mercadoLivreAccount.findMany({
    where: { isActive: true },
    select: { id: true, userId: true },
  });
  const donosDeConta = await prisma.user.findMany({
    where: { contaId: null },
    select: { id: true },
  });

  const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const mesCorrente = mesReferenciaDe(new Date());
  const competenciaAtual = competenciaDe(new Date());
  const competenciaAnterior = competenciaAnteriorA(competenciaAtual);

  let contasProcessadas = 0;
  let pedidosProcessados = 0;
  let gastosAdsProcessados = 0;
  let cobrancasProcessadas = 0;
  let faltantesImportados = 0;
  let lancamentosRecorrentesGerados = 0;
  let alertasGerados = 0;
  let erros = 0;

  for (const conta of contasAtivas) {
    try {
      await enfileirarIncremental(conta.id, 5);
      for (let rodada = 0; rodada < RODADAS_MAXIMAS_FILA; rodada++) {
        const resultado = await executarFila(conta.userId, conta.id, ORCAMENTO_FILA_MS);
        pedidosProcessados += resultado.processados;
        if (resultado.status === "OCIOSO" || resultado.status === "ERRO") break;
      }
      contasProcessadas++;
    } catch (error) {
      erros++;
      console.error(
        `[CRON_FINANCEIRO_DIARIO] Erro ao processar a fila da conta ${conta.id}:`,
        error
      );
    }

    try {
      const resultadoAds = await ingerirGastosAdsDoDia(conta.id, ontem);
      gastosAdsProcessados += resultadoAds.processados;
    } catch (error) {
      erros++;
      console.error(
        `[CRON_FINANCEIRO_DIARIO] Erro ao ingerir ads da conta ${conta.id}:`,
        error
      );
    }

    try {
      const resultadoCobrancas = await ingerirCobrancasDoMes(conta.id, mesCorrente);
      cobrancasProcessadas += resultadoCobrancas.processadas;
    } catch (error) {
      erros++;
      console.error(
        `[CRON_FINANCEIRO_DIARIO] Erro ao ingerir cobranças da conta ${conta.id}:`,
        error
      );
    }

    try {
      await reprocessarErrosPendentes(conta.id);
    } catch (error) {
      erros++;
      console.error(
        `[CRON_FINANCEIRO_DIARIO] Erro ao reprocessar erros pendentes da conta ${conta.id}:`,
        error
      );
    }

    for (const competencia of [competenciaAtual, competenciaAnterior]) {
      try {
        const resultadoConferencia = await conferirMes(conta.userId, conta.id, competencia);
        if (resultadoConferencia.faltando.length > 0) {
          const resultadoImportacao = await importarFaltantes(conta.id, resultadoConferencia.faltando);
          faltantesImportados += resultadoImportacao.importados;
        }
      } catch (error) {
        erros++;
        console.error(
          `[CRON_FINANCEIRO_DIARIO] Erro ao conferir ${competencia.ano}-${competencia.mes} da conta ${conta.id}:`,
          error
        );
      }
    }
  }

  for (const dono of donosDeConta) {
    try {
      const resultado = await gerarLancamentosDeTodasAsRecorrencias(dono.id);
      lancamentosRecorrentesGerados += resultado.gerados;
    } catch (error) {
      erros++;
      console.error(
        `[CRON_FINANCEIRO_DIARIO] Erro ao gerar recorrências da conta ${dono.id}:`,
        error
      );
    }

    try {
      const resultadoAlertas = await gerarAlertasFinanceiros(dono.id);
      alertasGerados +=
        resultadoAlertas.contasAVencer +
        resultadoAlertas.contasVencidas +
        resultadoAlertas.vendasComPrejuizo +
        resultadoAlertas.divergenciasConciliacao;
    } catch (error) {
      erros++;
      console.error(
        `[CRON_FINANCEIRO_DIARIO] Erro ao gerar alertas da conta ${dono.id}:`,
        error
      );
    }
  }

  return NextResponse.json({
    contasElegiveis: contasAtivas.length,
    contasProcessadas,
    pedidosProcessados,
    gastosAdsProcessados,
    cobrancasProcessadas,
    faltantesImportados,
    lancamentosRecorrentesGerados,
    alertasGerados,
    erros,
  });
}
