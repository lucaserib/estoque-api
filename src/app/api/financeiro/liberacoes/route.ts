import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { exigirVisualizacao, permissaoErrorResponse } from "@/lib/permissoes";
import { conferirLiberacoes } from "@/modules/financeiro/canais/mercadoPago/liberacoes";

/**
 * Só devolve dado se ConfiguracaoGeral.usarRelatorioLiberacaoMercadoPago
 * estiver ligado (etapa opcional, Fase 4 item 4) — serve para conferência
 * manual na tela de configurações (Fase 7), nunca alimenta a DRE.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
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

    const resultado = await conferirLiberacoes(
      user.contaId,
      conta.id,
      new Date(desde),
      new Date(ate)
    );

    return NextResponse.json(resultado);
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao conferir liberações do Mercado Pago:", error);
    return NextResponse.json(
      { error: "Erro ao conferir liberações" },
      { status: 500 }
    );
  }
}
