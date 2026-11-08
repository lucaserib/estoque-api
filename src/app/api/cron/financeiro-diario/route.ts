import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { enfileirarCobrancas, enfileirarIncremental, executarFila } from "@/modules/financeiro/ingestao/fila";
import { garantirHistoricoAtualizado } from "@/modules/financeiro/ingestao/statusSincronizacao";
import { corrigirMes } from "@/modules/financeiro/relatorios/conferencia";
import { competenciaDe } from "@/modules/financeiro/dominio/periodo";
import { gerarLancamentosDeTodasAsRecorrencias } from "@/modules/financeiro/lancamentos/recorrencias";
import { gerarAlertasFinanceiros } from "@/modules/financeiro/alertas";
import { sincronizarSaldoMercadoPago } from "@/modules/financeiro/canais/mercadoPago/saldo";
import { sincronizarNotasFiscais } from "@/modules/financeiro/canais/erp/bling/notasFiscais";
import { atualizarCustoDasVendasAposMudanca } from "@/modules/financeiro/ingestao/sincronizador";

export const maxDuration = 60;

const ORCAMENTO_FILA_MS = 20000;
const ORCAMENTO_NOTAS_MS = 6000;
const DIAS_NOTAS = 3;

function competenciaAnteriorA(competencia: { ano: number; mes: number }) {
  return competencia.mes === 1
    ? { ano: competencia.ano - 1, mes: 12 }
    : { ano: competencia.ano, mes: competencia.mes - 1 };
}

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
      Sentry.captureException(error, { tags: { cron: "financeiro-diario", etapa: "sincronizar-conta", contaId: conta.id } });
    }

    try {
      await sincronizarSaldoMercadoPago(conta.id);
    } catch (error) {
      console.error(`[CRON_FINANCEIRO_DIARIO] Erro ao preparar a conta Mercado Pago ${conta.id}:`, error);
      Sentry.captureException(error, { tags: { cron: "financeiro-diario", etapa: "saldo-mercado-pago", contaId: conta.id } });
    }
  }

  let vendasComCustoPreenchido = 0;
  for (const dono of donosDeConta) {
    const preenchimento = await atualizarCustoDasVendasAposMudanca(dono.id);
    vendasComCustoPreenchido += preenchimento?.vendasAtualizadas ?? 0;

    try {
      const resultado = await gerarLancamentosDeTodasAsRecorrencias(dono.id);
      lancamentosRecorrentesGerados += resultado.gerados;
    } catch (error) {
      erros++;
      console.error(`[CRON_FINANCEIRO_DIARIO] Erro ao gerar recorrências da conta ${dono.id}:`, error);
      Sentry.captureException(error, { tags: { cron: "financeiro-diario", etapa: "recorrencias", contaId: dono.id } });
    }

    try {
      const resultadoAlertas = await gerarAlertasFinanceiros(dono.id);
      alertasGerados +=
        resultadoAlertas.contasAVencer +
        resultadoAlertas.contasVencidas +
        resultadoAlertas.vendasComPrejuizo +
        resultadoAlertas.divergenciasConciliacao +
        resultadoAlertas.rupturasPrevistas;
    } catch (error) {
      erros++;
      console.error(`[CRON_FINANCEIRO_DIARIO] Erro ao gerar alertas da conta ${dono.id}:`, error);
      Sentry.captureException(error, { tags: { cron: "financeiro-diario", etapa: "alertas", contaId: dono.id } });
    }
  }

  let notasGravadas = 0;
  const contasBling = await prisma.blingAccount.findMany({
    where: { isActive: true },
    select: { userId: true },
    distinct: ["userId"],
  });
  for (const contaBling of contasBling) {
    try {
      const resultado = await sincronizarNotasFiscais(
        contaBling.userId,
        new Date(agora.getTime() - DIAS_NOTAS * 24 * 60 * 60 * 1000),
        agora,
        ORCAMENTO_NOTAS_MS
      );
      notasGravadas += resultado.gravadas;
    } catch (error) {
      erros++;
      console.error(`[CRON_FINANCEIRO_DIARIO] Erro ao trazer notas fiscais da conta ${contaBling.userId}:`, error);
      Sentry.captureException(error, { tags: { cron: "financeiro-diario", etapa: "notas-fiscais", contaId: contaBling.userId } });
    }
  }

  return NextResponse.json({
    contasElegiveis: contasAtivas.length,
    notasGravadas,
    contasProcessadas,
    pedidosProcessados,
    vendasDetalhadas,
    pedidosCorrigidos,
    lancamentosRecorrentesGerados,
    alertasGerados,
    vendasComCustoPreenchido,
    erros,
  });
}
