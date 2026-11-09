import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { prisma } from "@/lib/prisma";
import { exigirVisualizacao, permissaoErrorResponse } from "@/lib/permissoes";
import { listarMovimentosCarteira } from "@/modules/financeiro/canais/mercadoPago/movimentosCarteira";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUserAtivo(request);
    exigirVisualizacao(user.role, "FINANCEIRO_VER");

    const { searchParams } = new URL(request.url);
    const desde = searchParams.get("desde");
    const ate = searchParams.get("ate");
    const accountId = searchParams.get("accountId");

    if (!desde || !ate) {
      return NextResponse.json(
        { error: "Parâmetros desde e ate são obrigatórios" },
        { status: 400 }
      );
    }

    const conta = await prisma.mercadoLivreAccount.findFirst({
      where: {
        userId: user.contaId,
        isActive: true,
        ...(accountId ? { id: accountId } : {}),
      },
      select: { id: true },
    });

    if (!conta) {
      return NextResponse.json(
        { error: "Nenhuma conta do Mercado Livre ativa foi encontrada" },
        { status: 404 }
      );
    }

    const resultado = await listarMovimentosCarteira(
      user.contaId,
      conta.id,
      new Date(desde),
      new Date(ate)
    );

    return NextResponse.json(resultado);
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao listar movimentos da carteira Mercado Pago:", error);
    return NextResponse.json({ error: "Erro ao listar movimentos da carteira" }, { status: 500 });
  }
}
