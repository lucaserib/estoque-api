import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { exigirPermissao, permissaoErrorResponse } from "@/lib/permissoes";
import { sincronizarFinanceiro, type ModoSincronizacao } from "@/modules/financeiro/ingestao/orquestrador";

export const maxDuration = 60;

interface RequestBody {
  accountId?: string;
  modo?: ModoSincronizacao;
  desde?: string;
  ate?: string;
  forcar?: boolean;
}

const MODOS_VALIDOS: ModoSincronizacao[] = ["INCREMENTAL", "PERIODO", "BACKFILL"];

function dataValida(valor?: string): Date | undefined {
  if (!valor) return undefined;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? undefined : data;
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "FINANCEIRO_EDITAR");

    const body: RequestBody = await request.json().catch(() => ({}));
    const modo = body.modo && MODOS_VALIDOS.includes(body.modo) ? body.modo : "INCREMENTAL";

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

    const resultado = await sincronizarFinanceiro(conta.id, {
      modo,
      desde: dataValida(body.desde),
      ate: dataValida(body.ate),
      forcar: body.forcar ?? modo !== "INCREMENTAL",
      orcamentoMs: 45000,
    });

    return NextResponse.json(resultado);
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao sincronizar financeiro:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao sincronizar financeiro" },
      { status: 500 }
    );
  }
}
