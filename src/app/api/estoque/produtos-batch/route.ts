import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/estoque/produtos-batch?ids=id1,id2,id3
 * Retorna o estoque agregado de vários produtos numa única chamada,
 * evitando o N+1 de /api/estoque/produto/<id> por linha da tabela.
 * Resposta: { [produtoId]: { totalQuantity, estoqueSeguranca } }
 */
export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("ids");

    if (!idsParam) {
      return NextResponse.json(
        { error: "Parâmetro ids não fornecido" },
        { status: 400 }
      );
    }

    const ids = idsParam.split(",").filter(Boolean).slice(0, 500);
    if (ids.length === 0) {
      return NextResponse.json({});
    }

    const estoques = await prisma.estoque.findMany({
      where: {
        produtoId: { in: ids },
        produto: { userId: user.id },
      },
      select: {
        produtoId: true,
        quantidade: true,
        estoqueSeguranca: true,
      },
    });

    const result: Record<
      string,
      { totalQuantity: number; estoqueSeguranca: number }
    > = {};

    for (const id of ids) {
      result[id] = { totalQuantity: 0, estoqueSeguranca: 0 };
    }
    for (const estoque of estoques) {
      const entry = result[estoque.produtoId];
      if (!entry) continue;
      entry.totalQuantity += estoque.quantidade;
      entry.estoqueSeguranca = Math.max(
        entry.estoqueSeguranca,
        estoque.estoqueSeguranca || 0
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[ESTOQUE_BATCH] Erro:", error);
    return NextResponse.json(
      { error: "Erro ao buscar estoque dos produtos" },
      { status: 500 }
    );
  }
}
