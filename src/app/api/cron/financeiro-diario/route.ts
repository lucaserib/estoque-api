import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reprocessarUltimosDias } from "@/modules/financeiro/ingestao/sincronizador";
import { ingerirGastosAdsDoDia } from "@/modules/financeiro/ingestao/ingestaoAds";
import { ingerirCobrancasDoMes } from "@/modules/financeiro/ingestao/ingestaoCobrancas";

function mesReferenciaDe(data: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).format(data);
}

/**
 * Único cron diário do financeiro (plano Hobby da Vercel só roda 1x/dia por
 * rota). Reprocessa os últimos 3 dias de cada conta ML (cancelamentos,
 * devoluções, frete que chega depois), o gasto de ads de ontem e a cobrança
 * do mês corrente (idempotente — vai se corrigindo sozinha dia a dia até o
 * ML finalizar a fatura). Fases futuras (recorrências, snapshot, alertas)
 * se somam aqui, não em rotas novas.
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

  const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const mesCorrente = mesReferenciaDe(new Date());

  let contasProcessadas = 0;
  let pedidosProcessados = 0;
  let gastosAdsProcessados = 0;
  let cobrancasProcessadas = 0;
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

  return NextResponse.json({
    contasElegiveis: contasAtivas.length,
    contasProcessadas,
    pedidosProcessados,
    gastosAdsProcessados,
    cobrancasProcessadas,
    erros,
  });
}
