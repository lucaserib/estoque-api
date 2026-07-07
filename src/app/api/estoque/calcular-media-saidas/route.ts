import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/estoque/calcular-media-saidas?produtoId=xxx&dias=90
 * Calcula a média diária de saídas de um produto no período informado.
 * Resposta: { mediaDiaria, totalSaidas, dias }
 */
export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);
    const produtoId = searchParams.get("produtoId");
    const dias = Math.max(1, parseInt(searchParams.get("dias") || "90", 10));

    if (!produtoId) {
      return NextResponse.json(
        { error: "ID do produto não fornecido" },
        { status: 400 }
      );
    }

    // Garantir que o produto pertence ao usuário
    const produto = await prisma.produto.findFirst({
      where: { id: produtoId, userId: user.id },
      select: { id: true },
    });
    if (!produto) {
      return NextResponse.json(
        { error: "Produto não encontrado" },
        { status: 404 }
      );
    }

    const inicio = new Date();
    inicio.setDate(inicio.getDate() - dias);

    const detalhes = await prisma.detalhesSaida.findMany({
      where: {
        produtoId,
        saida: {
          userId: user.id,
          data: { gte: inicio },
        },
      },
      select: { quantidade: true },
    });

    const totalSaidas = detalhes.reduce((sum, d) => sum + d.quantidade, 0);
    const mediaDiaria = totalSaidas / dias;

    return NextResponse.json({ mediaDiaria, totalSaidas, dias });
  } catch (error) {
    console.error("[CALCULAR_MEDIA_SAIDAS] Erro:", error);
    return NextResponse.json(
      { error: "Erro ao calcular média de saídas" },
      { status: 500 }
    );
  }
}
