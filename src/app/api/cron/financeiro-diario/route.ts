import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reprocessarUltimosDias } from "@/modules/financeiro/ingestao/sincronizador";
import { ingerirGastosAdsDoDia } from "@/modules/financeiro/ingestao/ingestaoAds";
import { ingerirCobrancasDoMes } from "@/modules/financeiro/ingestao/ingestaoCobrancas";
import { gerarLancamentosDeTodasAsRecorrencias } from "@/modules/financeiro/lancamentos/recorrencias";
import { gerarAlertasFinanceiros } from "@/modules/financeiro/alertas";

function mesReferenciaDe(data: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).format(data);
}

/**
 * Único cron diário do financeiro (plano Hobby da Vercel só roda 1x/dia por
 * rota). Por conta ML: reprocessa os últimos 3 dias (cancelamentos,
 * devoluções, frete que chega depois), o gasto de ads de ontem e a cobrança
 * do mês corrente (idempotente — vai se corrigindo sozinha dia a dia até o
 * ML finalizar a fatura). Por conta (dono), independente de ter ML: gera os
 * lançamentos PREVISTO das recorrências ativas e os alertas financeiros
 * (contas a vencer/vencidas, venda com prejuízo, divergência de
 * conciliação — Ciclo 7 Fase 8). O "snapshot" diário (ResumoFinanceiroDiario)
 * já é escrito como efeito colateral da própria ingestão acima, não é um
 * passo separado.
 */
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
    select: { id: true },
  });
  const donosDeConta = await prisma.user.findMany({
    where: { contaId: null },
    select: { id: true },
  });

  const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const mesCorrente = mesReferenciaDe(new Date());

  let contasProcessadas = 0;
  let pedidosProcessados = 0;
  let gastosAdsProcessados = 0;
  let cobrancasProcessadas = 0;
  let lancamentosRecorrentesGerados = 0;
  let alertasGerados = 0;
  let erros = 0;

  for (const conta of contasAtivas) {
    try {
      const resultado = await reprocessarUltimosDias(conta.id);
      pedidosProcessados += resultado.processados;
      contasProcessadas++;
    } catch (error) {
      erros++;
      console.error(
        `[CRON_FINANCEIRO_DIARIO] Erro ao reprocessar pedidos da conta ${conta.id}:`,
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
    lancamentosRecorrentesGerados,
    alertasGerados,
    erros,
  });
}
