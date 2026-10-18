import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { exigirPermissao, permissaoErrorResponse } from "@/lib/permissoes";
import { sincronizarFinanceiro } from "@/modules/financeiro/ingestao/orquestrador";

export const maxDuration = 60;

const DIAS_PADRAO_HISTORICO = 365;
const DIAS_MAXIMOS_HISTORICO = 730;

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

    const dias = Math.min(Math.max(body.dias ?? DIAS_PADRAO_HISTORICO, 1), DIAS_MAXIMOS_HISTORICO);
    const ate = new Date();
    const desde = new Date(ate.getTime() - dias * 24 * 60 * 60 * 1000);

    const resultado = await sincronizarFinanceiro(conta.id, {
      modo: "BACKFILL",
      desde,
      ate,
      forcar: body.forcar ?? true,
      orcamentoMs: 45000,
    });

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
