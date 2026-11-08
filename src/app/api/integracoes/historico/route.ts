import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyUser } from "@/helpers/verifyUser";

const STATUS_LABELS: Record<string, string> = {
  processing: "Em andamento",
  success: "Concluído",
  partial: "Parcial",
  error: "Falhou",
  interrompida: "Interrompida (tempo esgotado)",
};

const LIMITE_EM_ANDAMENTO_MS = 15 * 60 * 1000;
function statusReal(status: string, inicio: Date): string {
  return status === "processing" && Date.now() - inicio.getTime() > LIMITE_EM_ANDAMENTO_MS ? "interrompida" : status;
}

export async function GET(req: NextRequest) {
  try {
    const user = await verifyUser(req);

    const [mlHistory, blingHistory] = await Promise.all([
      prisma.mercadoLivreSyncHistory.findMany({
        where: { mercadoLivreAccount: { userId: user.contaId } },
        orderBy: { startedAt: "desc" },
        take: 15,
        select: {
          id: true,
          syncType: true,
          status: true,
          syncedItems: true,
          startedAt: true,
        },
      }),
      prisma.blingSyncHistory.findMany({
        where: { blingAccount: { userId: user.contaId } },
        orderBy: { startedAt: "desc" },
        take: 15,
        select: {
          id: true,
          syncType: true,
          status: true,
          syncedItems: true,
          startedAt: true,
        },
      }),
    ]);

    const combined = [
      ...mlHistory.map((h) => ({
        id: h.id,
        quando: h.startedAt,
        origem: "Mercado Livre",
        escopo: h.syncType,
        registros: h.syncedItems,
        resultado: STATUS_LABELS[statusReal(h.status, h.startedAt)] || h.status,
        status: statusReal(h.status, h.startedAt),
      })),
      ...blingHistory.map((h) => ({
        id: h.id,
        quando: h.startedAt,
        origem: "Bling",
        escopo: h.syncType,
        registros: h.syncedItems,
        resultado: STATUS_LABELS[statusReal(h.status, h.startedAt)] || h.status,
        status: statusReal(h.status, h.startedAt),
      })),
    ]
      .sort((a, b) => new Date(b.quando).getTime() - new Date(a.quando).getTime())
      .slice(0, 20);

    return NextResponse.json({ historico: combined });
  } catch (error) {
    console.error("Erro ao buscar histórico de sincronização:", error);
    return NextResponse.json({ error: "Erro ao buscar histórico" }, { status: 500 });
  }
}
