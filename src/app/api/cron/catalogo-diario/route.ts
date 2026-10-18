import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sincronizarCatalogoSeNecessario } from "@/modules/catalogo/sincronizacao";

export const maxDuration = 60;

/**
 * Uma vez por dia: começa (ou continua) a sincronização de catálogo e estoque
 * de cada conta com Bling ou Mercado Livre conectado. O que não couber no
 * tempo continua quando alguém abrir Produtos, Estoque ou o Dashboard.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const [bling, ml] = await Promise.all([
    prisma.blingAccount.findMany({ where: { isActive: true }, select: { userId: true } }),
    prisma.mercadoLivreAccount.findMany({ where: { isActive: true }, select: { userId: true } }),
  ]);
  const donos = [...new Set([...bling, ...ml].map((c) => c.userId))];
  const orcamentoPorConta = Math.max(10000, Math.floor(50000 / Math.max(1, donos.length)));

  const resultados: Array<{ userId: string; etapa: string | null; erro: string | null }> = [];
  for (const userId of donos) {
    try {
      const status = await sincronizarCatalogoSeNecessario(userId, orcamentoPorConta, { horasValidade: 20 });
      resultados.push({ userId, etapa: status.etapa, erro: status.erro });
    } catch (error) {
      resultados.push({ userId, etapa: null, erro: error instanceof Error ? error.message : "erro" });
    }
  }

  return NextResponse.json({ contas: resultados.length, resultados });
}
