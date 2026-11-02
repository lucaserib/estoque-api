import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const progresso = await prisma.onboardingProgresso.findUnique({
      where: { userId: user.contaId },
      select: { tourVisto: true },
    });
    return NextResponse.json({ tourVisto: progresso?.tourVisto ?? false });
  } catch (error) {
    console.error("Erro ao buscar status do tour:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    await prisma.onboardingProgresso.upsert({
      where: { userId: user.contaId },
      update: { tourVisto: true },
      create: { userId: user.contaId, tourVisto: true },
    });
    return NextResponse.json({ tourVisto: true });
  } catch (error) {
    console.error("Erro ao marcar tour como visto:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
