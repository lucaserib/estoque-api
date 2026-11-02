import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { mlCache, createCacheKey } from "@/lib/cache";

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const body = await request.json().catch(() => ({}));
    const marcador = typeof body.marcador === "string" ? body.marcador : String(body.etapaId ?? "");

    if (!marcador || !/^\d+(_[a-z]+)?$/.test(marcador)) {
      return NextResponse.json({ error: "marcador inválido" }, { status: 400 });
    }

    const atual = await prisma.onboardingProgresso.findUnique({ where: { userId: user.contaId } });
    const etapasPuladas = Array.from(new Set([...(atual?.etapasPuladas ?? []), marcador]));

    await prisma.onboardingProgresso.upsert({
      where: { userId: user.contaId },
      update: { etapasPuladas },
      create: { userId: user.contaId, etapasPuladas },
    });

    await mlCache.delete(createCacheKey("onboarding", user.contaId));

    return NextResponse.json({ etapasPuladas });
  } catch (error) {
    console.error("Erro ao pular etapa do onboarding:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
