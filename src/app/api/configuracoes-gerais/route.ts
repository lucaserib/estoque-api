import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { exigirPermissao, permissaoErrorResponse } from "@/lib/permissoes";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);

    const config = await prisma.configuracaoGeral.findUnique({
      where: { userId: user.contaId },
    });

    return NextResponse.json({
      aliquotaImposto: config?.aliquotaImposto ?? 0,
    });
  } catch (error) {
    console.error("Erro ao buscar configurações gerais:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "VER_CUSTO");

    const { aliquotaImposto } = await request.json();

    if (
      typeof aliquotaImposto !== "number" ||
      Number.isNaN(aliquotaImposto) ||
      aliquotaImposto < 0 ||
      aliquotaImposto > 1
    ) {
      return NextResponse.json(
        { error: "aliquotaImposto deve ser um número entre 0 e 1" },
        { status: 400 }
      );
    }

    const config = await prisma.configuracaoGeral.upsert({
      where: { userId: user.contaId },
      update: { aliquotaImposto },
      create: { userId: user.contaId, aliquotaImposto },
    });

    return NextResponse.json({ aliquotaImposto: config.aliquotaImposto });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao atualizar configurações gerais:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
