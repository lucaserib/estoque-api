import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  BlingService,
  BlingReconnectError,
  BlingTransientError,
} from "@/services/blingService";

const EXPIRATION_LOOKAHEAD_MS = 12 * 60 * 60 * 1000;
const MAX_CALLS_PER_MINUTE = 10;
const DELAY_BETWEEN_CALLS_MS = Math.ceil(60000 / MAX_CALLS_PER_MINUTE);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const accountsNearingExpiry = await prisma.blingAccount.findMany({
    where: {
      isActive: true,
      expiresAt: { lte: new Date(Date.now() + EXPIRATION_LOOKAHEAD_MS) },
    },
    select: { id: true },
  });

  let renovadas = 0;
  let desativadas = 0;
  let erros = 0;

  for (let i = 0; i < accountsNearingExpiry.length; i++) {
    const account = accountsNearingExpiry[i];

    try {
      await BlingService.refreshAccountTokens(account.id);
      renovadas++;
    } catch (error) {
      if (error instanceof BlingReconnectError) {
        desativadas++;
      } else if (error instanceof BlingTransientError) {
        erros++;
        console.error(
          `[CRON_BLING] Erro transitório ao renovar conta ${account.id}:`,
          error
        );
      } else {
        erros++;
        console.error(
          `[CRON_BLING] Falha ao renovar conta ${account.id}:`,
          error
        );
      }
    }

    if (i < accountsNearingExpiry.length - 1) {
      await sleep(DELAY_BETWEEN_CALLS_MS);
    }
  }

  return NextResponse.json({
    elegiveis: accountsNearingExpiry.length,
    renovadas,
    desativadas,
    erros,
  });
}
