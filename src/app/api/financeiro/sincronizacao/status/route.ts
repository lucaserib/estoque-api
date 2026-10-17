import { NextRequest, NextResponse } from "next/server";
import { CanalVenda } from "@prisma/client";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { exigirVisualizacao, permissaoErrorResponse } from "@/lib/permissoes";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirVisualizacao(user.role, "FINANCEIRO_VER");

    const [ultimaConcluida, emAndamento, erroPendentesCount] = await Promise.all([
      prisma.sincronizacaoFinanceira.findFirst({
        where: { userId: user.contaId, canal: CanalVenda.MERCADO_LIVRE, status: "CONCLUIDO" },
        orderBy: { concluidoEm: "desc" },
      }),
      prisma.sincronizacaoFinanceira.findFirst({
        where: { userId: user.contaId, canal: CanalVenda.MERCADO_LIVRE, status: "EM_ANDAMENTO" },
        orderBy: { iniciadoEm: "desc" },
      }),
      prisma.sincronizacaoFinanceiraErro.count({
        where: { userId: user.contaId, canal: CanalVenda.MERCADO_LIVRE, resolvidoEm: null },
      }),
    ]);

    return NextResponse.json({
      emAndamento: emAndamento
        ? { tipo: emAndamento.tipo, processados: emAndamento.processados, iniciadoEm: emAndamento.iniciadoEm }
        : null,
      ultimaSincronizacaoConcluidaEm: ultimaConcluida?.concluidoEm ?? null,
      errosPendentes: erroPendentesCount,
    });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao obter status da sincronização financeira:", error);
    return NextResponse.json({ error: "Erro ao obter status da sincronização financeira" }, { status: 500 });
  }
}
