import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyUser } from "@/helpers/verifyUser";
import { FULL_ARMAZEM_NOME } from "@/lib/estoque";
import { exigirPermissao, permissaoErrorResponse } from "@/lib/permissoes";

const ajustarSchema = z.object({
  produtoId: z.string().min(1),
  armazemId: z.string().min(1),
  quantidade: z.number().int().min(0),
  observacao: z.string().max(280).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "ESTOQUE_AJUSTAR");
    const parsed = ajustarSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { produtoId, armazemId, quantidade, observacao } = parsed.data;

    const [produto, armazem] = await Promise.all([
      prisma.produto.findFirst({ where: { id: produtoId, userId: user.contaId } }),
      prisma.armazem.findFirst({ where: { id: armazemId, userId: user.contaId } }),
    ]);

    if (!produto) {
      return NextResponse.json(
        { error: "Produto não encontrado" },
        { status: 404 }
      );
    }

    if (!armazem) {
      return NextResponse.json(
        { error: "Armazém não encontrado" },
        { status: 404 }
      );
    }

    if (armazem.nome === FULL_ARMAZEM_NOME) {
      return NextResponse.json(
        {
          error:
            "O armazém Full é sincronizado automaticamente com o Mercado Livre e não pode ser ajustado manualmente",
        },
        { status: 403 }
      );
    }

    const estoqueAtual = await prisma.estoque.findUnique({
      where: { produtoId_armazemId: { produtoId, armazemId } },
    });

    const quantidadeAnterior = estoqueAtual?.quantidade ?? 0;

    const [estoqueAtualizado] = await prisma.$transaction([
      prisma.estoque.upsert({
        where: { produtoId_armazemId: { produtoId, armazemId } },
        create: { produtoId, armazemId, quantidade },
        update: { quantidade },
      }),
      prisma.estoqueMovimentacao.create({
        data: {
          userId: user.id,
          produtoId,
          armazemId,
          quantidadeAnterior,
          quantidadeNova: quantidade,
          origem: "AJUSTE_MANUAL",
          observacao,
        },
      }),
    ]);

    return NextResponse.json({ success: true, estoque: estoqueAtualizado });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao ajustar estoque:", error);
    return NextResponse.json(
      { error: "Erro ao ajustar estoque" },
      { status: 500 }
    );
  }
}
