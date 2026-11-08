import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyUser } from "@/helpers/verifyUser";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);
    const produtoId = searchParams.get("produtoId");
    const armazemId = searchParams.get("armazemId");

    if (!produtoId || !armazemId) {
      return NextResponse.json(
        { error: "Produto e armazém são obrigatórios" },
        { status: 400 }
      );
    }

    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - 90);

    const detalhesSaidas = await prisma.detalhesSaida.findMany({
      where: {
        produtoId,
        saida: {
          armazemId,
          userId: user.contaId,
          data: {
            gte: dataInicio,
          },
        },
      },
      include: {
        saida: {
          select: {
            data: true,
          },
        },
      },
    });

    if (detalhesSaidas.length === 0) {
      return NextResponse.json({ mediaDiaria: 0, totalSaidas: 0, periodo: 90 });
    }

    const totalQuantidade = detalhesSaidas.reduce(
      (total, detalhe) => total + detalhe.quantidade,
      0
    );

    const mediaDiaria = totalQuantidade / 90;

    return NextResponse.json({
      mediaDiaria,
      totalSaidas: detalhesSaidas.length,
      totalQuantidade,
      periodo: 90,
    });
  } catch (error) {
    console.error("Erro ao calcular consumo diário:", error);
    return NextResponse.json(
      { error: "Erro ao calcular consumo diário" },
      { status: 500 }
    );
  }
}
