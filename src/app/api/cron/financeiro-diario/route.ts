import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reprocessarUltimosDias } from "@/modules/financeiro/ingestao/sincronizador";

/**
 * Único cron diário do financeiro (plano Hobby da Vercel só roda 1x/dia por
 * rota). Reprocessa os últimos 3 dias de cada conta ML para pegar
 * cancelamentos, devoluções e custo de frete que chegam depois da venda.
 * Fases futuras (ads, cobranças, recorrências, snapshot, alertas) se somam
 * aqui, não em rotas novas.
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

  let contasProcessadas = 0;
  let pedidosProcessados = 0;
  let erros = 0;

  for (const conta of contasAtivas) {
    try {
      const resultado = await reprocessarUltimosDias(conta.id);
      pedidosProcessados += resultado.processados;
      contasProcessadas++;
    } catch (error) {
      erros++;
      console.error(
        `[CRON_FINANCEIRO_DIARIO] Erro ao reprocessar conta ${conta.id}:`,
        error
      );
    }
  }

  return NextResponse.json({
    contasElegiveis: contasAtivas.length,
    contasProcessadas,
    pedidosProcessados,
    erros,
  });
}
