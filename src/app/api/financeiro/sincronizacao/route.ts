import { NextRequest, NextResponse } from "next/server";
import { CanalVenda } from "@prisma/client";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { exigirPermissao, permissaoErrorResponse } from "@/lib/permissoes";
import { sincronizarFinanceiro, obterTravaAtiva, type ModoSincronizacao } from "@/modules/financeiro/ingestao/orquestrador";

export const maxDuration = 60;

interface RequestBody {
  accountId?: string;
  modo?: ModoSincronizacao;
  desde?: string;
  ate?: string;
}

const MODOS_VALIDOS: ModoSincronizacao[] = ["INCREMENTAL", "PERIODO", "BACKFILL"];

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

    const travaAtiva = await obterTravaAtiva(user.contaId, CanalVenda.MERCADO_LIVRE);
    if (travaAtiva) {
      return NextResponse.json(
        { status: "EM_ANDAMENTO", processados: 0, erros: 0, proximoPasso: "CONTINUAR" },
        { status: 200 }
      );
    }

    const resultado = await sincronizarFinanceiro(conta.id, {
      modo,
      desde: body.desde ? new Date(body.desde) : undefined,
      ate: body.ate ? new Date(body.ate) : undefined,
    });

    return NextResponse.json(resultado);
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao sincronizar financeiro:", error);
    return NextResponse.json({ error: "Erro ao sincronizar financeiro" }, { status: 500 });
  }
}
