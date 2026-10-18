import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { exigirPermissao, permissaoErrorResponse } from "@/lib/permissoes";

interface RequestBody {
  custoFreteManual?: number | null;
  custoEmbalagem?: number | null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "EDITAR_PRODUTO");
    const { id } = await params;

    const produto = await prisma.produto.findFirst({
      where: { id, userId: user.contaId },
      select: { id: true },
    });
    if (!produto) {
      return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
    }

    const body: RequestBody = await request.json().catch(() => ({}));

    if (body.custoFreteManual !== undefined && body.custoFreteManual != null && body.custoFreteManual < 0) {
      return NextResponse.json({ error: "custoFreteManual deve ser um número não negativo" }, { status: 400 });
    }
    if (body.custoEmbalagem !== undefined && body.custoEmbalagem != null && body.custoEmbalagem < 0) {
      return NextResponse.json({ error: "custoEmbalagem deve ser um número não negativo" }, { status: 400 });
    }

    const produtoAtualizado = await prisma.produto.update({
      where: { id },
      data: {
        ...(body.custoFreteManual !== undefined && { custoFreteManual: body.custoFreteManual }),
        ...(body.custoEmbalagem !== undefined && { custoEmbalagem: body.custoEmbalagem }),
      },
      select: { id: true, custoFreteManual: true, custoEmbalagem: true },
    });

    return NextResponse.json(produtoAtualizado);
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao atualizar custos de frete/embalagem do produto:", error);
    return NextResponse.json({ error: "Erro ao atualizar custos do produto" }, { status: 500 });
  }
}
