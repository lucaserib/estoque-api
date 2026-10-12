import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { exigirVisualizacao, permissaoErrorResponse } from "@/lib/permissoes";
import { listarFaturas } from "@/modules/financeiro/lancamentos/cartao";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirVisualizacao(user.role, "FINANCEIRO_VER");

    const { searchParams } = new URL(request.url);
    const contaFinanceiraId = searchParams.get("contaFinanceiraId") ?? undefined;

    const faturas = await listarFaturas(user.contaId, contaFinanceiraId);
    return NextResponse.json({ faturas });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao listar faturas:", error);
    return NextResponse.json({ error: "Erro ao listar faturas" }, { status: 500 });
  }
}
