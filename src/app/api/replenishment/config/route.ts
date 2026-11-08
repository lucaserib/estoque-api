import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);
    const produtoId = searchParams.get("produtoId");

    if (!produtoId) {
      return NextResponse.json(
        { error: "ID do produto é obrigatório" },
        { status: 400 }
      );
    }

    const config = await prisma.stockReplenishmentConfig.findFirst({
      where: {
        userId: user.contaId,
        produtoId,
      },
    });

    return NextResponse.json({
      config: config || {
        avgDeliveryDays: 7,
        fullReleaseDays: 3,
        safetyStock: 10,
        minCoverageDays: 30,
        analysisPeriodDays: 90,
      },
      isGlobal: !config,
    });
  } catch (error) {
    console.error("Erro ao buscar configuração de reposição:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao buscar configuração",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const body = await request.json();

    const {
      produtoId,
      avgDeliveryDays,
      fullReleaseDays,
      safetyStock,
      minCoverageDays,
      analysisPeriodDays,
    } = body;

    if (!produtoId) {
      return NextResponse.json(
        { error: "ID do produto é obrigatório" },
        { status: 400 }
      );
    }

    if (
      !avgDeliveryDays ||
      !fullReleaseDays ||
      safetyStock === undefined ||
      !minCoverageDays ||
      !analysisPeriodDays
    ) {
      return NextResponse.json(
        { error: "Dados incompletos" },
        { status: 400 }
      );
    }

    if (![30, 60, 90].includes(analysisPeriodDays)) {
      return NextResponse.json(
        { error: "Período de análise deve ser 30, 60 ou 90 dias" },
        { status: 400 }
      );
    }

    const config = await prisma.stockReplenishmentConfig.upsert({
      where: {
        userId_produtoId: {
          userId: user.contaId,
          produtoId: produtoId,
        },
      },
      update: {
        avgDeliveryDays,
        fullReleaseDays,
        safetyStock,
        minCoverageDays,
        analysisPeriodDays,
      },
      create: {
        userId: user.contaId,
        produtoId: produtoId,
        avgDeliveryDays,
        fullReleaseDays,
        safetyStock,
        minCoverageDays,
        analysisPeriodDays,
      },
    });

    return NextResponse.json({
      success: true,
      config,
    });
  } catch (error) {
    console.error("Erro ao salvar configuração de reposição:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erro ao salvar configuração",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);
    const produtoId = searchParams.get("produtoId");

    if (!produtoId) {
      return NextResponse.json(
        { error: "ID do produto não fornecido" },
        { status: 400 }
      );
    }

    await prisma.stockReplenishmentConfig.deleteMany({
      where: {
        userId: user.contaId,
        produtoId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao deletar configuração de reposição:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erro ao deletar configuração",
      },
      { status: 500 }
    );
  }
}
