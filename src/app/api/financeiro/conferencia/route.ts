import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { exigirPermissao, exigirVisualizacao, permissaoErrorResponse } from "@/lib/permissoes";
import { conferirMes, corrigirMes } from "@/modules/financeiro/relatorios/conferencia";

export const maxDuration = 60;

function validarMes(mes: string | null): { ano: number; mes: number } | null {
  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) return null;
  const [ano, mesNumero] = mes.split("-").map(Number);
  if (mesNumero < 1 || mesNumero > 12) return null;
  return { ano, mes: mesNumero };
}

async function obterContaAtiva(userId: string, accountId?: string | null) {
  return prisma.mercadoLivreAccount.findFirst({
    where: { userId, isActive: true, ...(accountId ? { id: accountId } : {}) },
    select: { id: true },
  });
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirVisualizacao(user.role, "FINANCEIRO_VER");

    const { searchParams } = new URL(request.url);
    const competencia = validarMes(searchParams.get("mes"));
    if (!competencia) {
      return NextResponse.json({ error: "Parâmetro 'mes' é obrigatório no formato AAAA-MM" }, { status: 400 });
    }

    const conta = await obterContaAtiva(user.contaId, searchParams.get("accountId"));
    if (!conta) {
      return NextResponse.json({ error: "Nenhuma conta do Mercado Livre ativa encontrada" }, { status: 404 });
    }

    const resultado = await conferirMes(user.contaId, conta.id, competencia);
    return NextResponse.json(resultado);
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;
    console.error("Erro ao conferir o mês contra o Mercado Livre:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao conferir o mês contra o Mercado Livre" },
      { status: 500 }
    );
  }
}

interface RequestBody {
  accountId?: string;
  mes?: string;
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "FINANCEIRO_EDITAR");

    const body: RequestBody = await request.json().catch(() => ({}));
    const competencia = validarMes(body.mes ?? null);
    if (!competencia) {
      return NextResponse.json({ error: "Informe 'mes' no formato AAAA-MM" }, { status: 400 });
    }

    const conta = await obterContaAtiva(user.contaId, body.accountId);
    if (!conta) {
      return NextResponse.json({ error: "Nenhuma conta do Mercado Livre ativa encontrada" }, { status: 404 });
    }

    const resultado = await corrigirMes(conta.id, competencia);
    return NextResponse.json(resultado);
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;
    console.error("Erro ao corrigir o mês com os dados do Mercado Livre:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao corrigir o mês" },
      { status: 500 }
    );
  }
}
