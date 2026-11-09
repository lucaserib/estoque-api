import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { prisma } from "@/lib/prisma";
import { permissaoErrorResponse } from "@/lib/permissoes";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUserAtivo(request);
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
        produto: { userId: user.contaId },
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
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    console.error("[ESTOQUE_BATCH] Erro:", error);
    return NextResponse.json(
      { error: "Erro ao buscar estoque dos produtos" },
      { status: 500 }
    );
  }
}
