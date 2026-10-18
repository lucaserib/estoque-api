import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { exigirPermissao, permissaoErrorResponse } from "@/lib/permissoes";
import { enfileirarPeriodo, executarFila } from "@/modules/financeiro/ingestao/fila";

export const maxDuration = 60;

const DIAS_PADRAO_HISTORICO = 365;

interface RequestBody {
  accountId?: string;
  dias?: number;
  forcar?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "FINANCEIRO_EDITAR");

    const body: RequestBody = await request.json().catch(() => ({}));

    const conta = await prisma.mercadoLivreAccount.findFirst({
      where: {
        userId: user.contaId,
        isActive: true,
        ...(body.accountId ? { id: body.accountId } : {}),
      },
      select: { id: true },
    });

    if (!conta) {
      return NextResponse.json(
        { error: "Nenhuma conta do Mercado Livre ativa foi encontrada" },
        { status: 404 }
      );
    }

    const dias = body.dias ?? DIAS_PADRAO_HISTORICO;
    const ate = new Date();
    const desde = new Date(ate.getTime() - dias * 24 * 60 * 60 * 1000);

    await enfileirarPeriodo(conta.id, desde, ate, 20, body.forcar ?? false);
    const resultadoFila = await executarFila(user.contaId, conta.id);

    return NextResponse.json({
      status: resultadoFila.status === "EM_ANDAMENTO" ? "EM_ANDAMENTO" : "CONCLUIDO",
      processados: resultadoFila.processados,
    });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao importar histórico financeiro:", error);
    return NextResponse.json(
      { error: "Erro ao importar histórico financeiro" },
      { status: 500 }
    );
  }
}
