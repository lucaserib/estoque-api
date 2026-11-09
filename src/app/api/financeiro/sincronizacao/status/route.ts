import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { exigirVisualizacao, permissaoErrorResponse } from "@/lib/permissoes";
import { obterStatusSincronizacao } from "@/modules/financeiro/ingestao/statusSincronizacao";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUserAtivo(request);
    exigirVisualizacao(user.role, "FINANCEIRO_VER");
    return NextResponse.json(await obterStatusSincronizacao(user.contaId));
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;
    console.error("Erro ao obter status da sincronização financeira:", error);
    return NextResponse.json({ error: "Erro ao obter status da sincronização financeira" }, { status: 500 });
  }
}
