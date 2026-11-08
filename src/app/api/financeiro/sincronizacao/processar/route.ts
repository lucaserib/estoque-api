import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { exigirVisualizacao, permissaoErrorResponse } from "@/lib/permissoes";
import { executarFila } from "@/modules/financeiro/ingestao/fila";
import { obterStatusSincronizacao } from "@/modules/financeiro/ingestao/statusSincronizacao";

export const maxDuration = 60;

const ORCAMENTO_MS = 45000;

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirVisualizacao(user.role, "FINANCEIRO_VER");

    const conta = await prisma.mercadoLivreAccount.findFirst({
      where: { userId: user.contaId, isActive: true },
      select: { id: true },
    });
    if (!conta) {
      return NextResponse.json({ error: "Nenhuma conta do Mercado Livre ativa foi encontrada" }, { status: 404 });
    }

    const resultado = await executarFila(user.contaId, conta.id, ORCAMENTO_MS);
    const status = await obterStatusSincronizacao(user.contaId);
    return NextResponse.json({ resultado, status });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;
    console.error("Erro ao processar a fila do financeiro:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao processar a fila do financeiro" },
      { status: 500 }
    );
  }
}
