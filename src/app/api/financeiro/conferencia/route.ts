import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import {
  conferirMes,
  importarFaltantes,
  reprocessarDivergentes,
} from "@/modules/financeiro/relatorios/conferencia";

export const maxDuration = 60;

function validarMes(mes: string | null): { ano: number; mes: number } | null {
  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) return null;
  const [ano, mesNumero] = mes.split("-").map(Number);
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
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Apenas administradores podem usar a conferência" }, { status: 403 });
    }

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
    console.error("Erro ao conferir o mês contra o Mercado Livre:", error);
    return NextResponse.json({ error: "Erro ao conferir o mês contra o Mercado Livre" }, { status: 500 });
  }
}

interface RequestBody {
  accountId?: string;
  acao?: "importar_faltantes" | "reprocessar_divergentes";
  pedidosExternoId?: string[];
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Apenas administradores podem usar a conferência" }, { status: 403 });
    }

    const body: RequestBody = await request.json().catch(() => ({}));
    if (!Array.isArray(body.pedidosExternoId) || body.pedidosExternoId.length === 0) {
      return NextResponse.json({ error: "Informe 'pedidosExternoId'" }, { status: 400 });
    }

    const conta = await obterContaAtiva(user.contaId, body.accountId);
    if (!conta) {
      return NextResponse.json({ error: "Nenhuma conta do Mercado Livre ativa encontrada" }, { status: 404 });
    }

    if (body.acao === "reprocessar_divergentes") {
      const resultado = await reprocessarDivergentes(conta.id, body.pedidosExternoId);
      return NextResponse.json(resultado);
    }

    const resultado = await importarFaltantes(conta.id, body.pedidosExternoId);
    return NextResponse.json(resultado);
  } catch (error) {
    console.error("Erro ao aplicar ação da conferência:", error);
    return NextResponse.json({ error: "Erro ao aplicar ação da conferência" }, { status: 500 });
  }
}
