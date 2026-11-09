import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { podeVer, permissaoErrorResponse } from "@/lib/permissoes";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ armazemId: string }> }
) {
  try {
    const user = await verifyUserAtivo(request);
    const { armazemId } = await params;

    if (!armazemId) {
      return NextResponse.json(
        { error: "ID do armazém não fornecido" },
        { status: 400 }
      );
    }

    const armazem = await prisma.armazem.findFirst({
      where: { id: armazemId, userId: user.contaId },
      select: { id: true },
    });

    if (!armazem) {
      return NextResponse.json(
        { error: "Armazém não encontrado" },
        { status: 404 }
      );
    }

    const estoque = await prisma.estoque.findMany({
      where: { armazemId, produto: { userId: user.contaId } },
      include: { produto: true },
    });

    const verCusto = podeVer(user.role, "VER_CUSTO");

    const serializedEstoque = estoque.map((item) => ({
      produtoId: item.produtoId,
      armazemId: item.armazemId,
      quantidade: item.quantidade,
      estoqueSeguranca: item.estoqueSeguranca ?? 0,
      produto: {
        id: item.produto.id,
        nome: item.produto.nome,
        sku: item.produto.sku,
        isKit: item.produto.isKit,
        custoMedio:
          verCusto && item.produto.custoMedio
            ? Number(item.produto.custoMedio)
            : null,
        ean: item.produto.ean ? item.produto.ean.toString() : null,
      },
    }));

    return NextResponse.json(serializedEstoque);
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    if (error instanceof Error && error.message.includes("não autorizado")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Erro ao buscar estoque" },
      { status: 500 }
    );
  }
}
