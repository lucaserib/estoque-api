import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { exigirPermissao, permissaoErrorResponse } from "@/lib/permissoes";
import { continuarBackfill } from "@/modules/financeiro/ingestao/sincronizador";

export const maxDuration = 60;

interface RequestBody {
  accountId?: string;
  dias?: number;
}

/**
 * Chamada repetidamente pela tela (botão "Importar histórico" com barra de
 * progresso, Fase 7): cada chamada processa um lote e devolve o status
 * acumulado. A tela chama de novo enquanto status for EM_ANDAMENTO.
 */
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

    const resultado = await continuarBackfill(conta.id, body.dias);

    return NextResponse.json(resultado);
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
