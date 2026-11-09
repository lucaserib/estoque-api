import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { prisma } from "@/lib/prisma";
import { permissaoErrorResponse } from "@/lib/permissoes";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUserAtivo(request);
    const progresso = await prisma.onboardingProgresso.findUnique({
      where: { userId: user.contaId },
      select: { tourVisto: true },
    });
    return NextResponse.json({ tourVisto: progresso?.tourVisto ?? false });
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    console.error("Erro ao buscar status do tour:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUserAtivo(request);
    await prisma.onboardingProgresso.upsert({
      where: { userId: user.contaId },
      update: { tourVisto: true },
      create: { userId: user.contaId, tourVisto: true },
    });
    return NextResponse.json({ tourVisto: true });
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    console.error("Erro ao marcar tour como visto:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
