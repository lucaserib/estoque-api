import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BlingService, BlingReconnectError } from "@/services/blingService";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const activeAccounts = await prisma.blingAccount.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  let renovadas = 0;
  let desativadas = 0;
  let erros = 0;

  for (const account of activeAccounts) {
    try {
      await BlingService.refreshAccountTokens(account.id);
      renovadas++;
    } catch (error) {
      if (error instanceof BlingReconnectError) {
        desativadas++;
      } else {
        erros++;
        console.error(
          `[CRON_BLING] Falha ao renovar conta ${account.id}:`,
          error
        );
      }
    }
  }

  return NextResponse.json({
    total: activeAccounts.length,
    renovadas,
    desativadas,
    erros,
  });
}
