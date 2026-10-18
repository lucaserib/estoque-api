import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enfileirarCobrancas, enfileirarIncremental, executarFila } from "@/modules/financeiro/ingestao/fila";
import { garantirHistoricoAtualizado } from "@/modules/financeiro/ingestao/statusSincronizacao";
import { corrigirMes } from "@/modules/financeiro/relatorios/conferencia";
import { competenciaDe } from "@/modules/financeiro/dominio/periodo";
import { gerarLancamentosDeTodasAsRecorrencias } from "@/modules/financeiro/lancamentos/recorrencias";
import { gerarAlertasFinanceiros } from "@/modules/financeiro/alertas";
import { sincronizarSaldoMercadoPago } from "@/modules/financeiro/canais/mercadoPago/saldo";

export const maxDuration = 60;

const ORCAMENTO_FILA_MS = 20000;

function competenciaAnteriorA(competencia: { ano: number; mes: number }) {
  return competencia.mes === 1
    ? { ano: competencia.ano - 1, mes: 12 }
    : { ano: competencia.ano, mes: competencia.mes - 1 };
}

/**
 * Uma vez por dia (plano Hobby): garante que o mês atual e o anterior batem
 * com o Mercado Livre (corrige o que faltar), atualiza o que mudou desde a
 * última sincronização, puxa a fatura do ML dos dois meses, processa a fila
 * por até 20 s e gera recorrências e alertas. O restante da fila é processado
 * quando alguém abre o Financeiro.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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

  const agora = new Date();
  const competenciaAtual = competenciaDe(agora);
  const competenciaAnterior = competenciaAnteriorA(competenciaAtual);
  const inicioMesAnterior = new Date(Date.UTC(competenciaAnterior.ano, competenciaAnterior.mes - 1, 15));

  let contasProcessadas = 0;
  let pedidosProcessados = 0;
  let vendasDetalhadas = 0;
  let pedidosCorrigidos = 0;
  let lancamentosRecorrentesGerados = 0;
  let alertasGerados = 0;
  let erros = 0;

  for (const conta of contasAtivas) {
    try {
      await garantirHistoricoAtualizado(conta.id);
      for (const competencia of [competenciaAtual, competenciaAnterior]) {
        const correcao = await corrigirMes(conta.id, competencia);
        pedidosCorrigidos += correcao.lote.gravados;
      }
      await enfileirarIncremental(conta.id, 30);
      await enfileirarCobrancas(conta.id, inicioMesAnterior, agora, 10);
      const resultado = await executarFila(conta.userId, conta.id, ORCAMENTO_FILA_MS);
      pedidosProcessados += resultado.processados;
      vendasDetalhadas += resultado.vendasDetalhadas;
      contasProcessadas++;
    } catch (error) {
      erros++;
      console.error(`[CRON_FINANCEIRO_DIARIO] Erro ao sincronizar a conta ${conta.id}:`, error);
    }

    try {
      await sincronizarSaldoMercadoPago(conta.id);
    } catch (error) {
      console.error(`[CRON_FINANCEIRO_DIARIO] Erro ao preparar a conta Mercado Pago ${conta.id}:`, error);
    }
  }

  for (const dono of donosDeConta) {
    try {
      const resultado = await gerarLancamentosDeTodasAsRecorrencias(dono.id);
      lancamentosRecorrentesGerados += resultado.gerados;
    } catch (error) {
      erros++;
      console.error(`[CRON_FINANCEIRO_DIARIO] Erro ao gerar recorrências da conta ${dono.id}:`, error);
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
      console.error(`[CRON_FINANCEIRO_DIARIO] Erro ao gerar alertas da conta ${dono.id}:`, error);
    }
  }

  return NextResponse.json({
    contasElegiveis: contasAtivas.length,
    contasProcessadas,
    pedidosProcessados,
    vendasDetalhadas,
    pedidosCorrigidos,
    lancamentosRecorrentesGerados,
    alertasGerados,
    erros,
  });
}
