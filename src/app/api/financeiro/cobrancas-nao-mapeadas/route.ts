import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { exigirVisualizacao, permissaoErrorResponse } from "@/lib/permissoes";
import { listarCobrancasNaoMapeadas } from "@/modules/financeiro/relatorios/cobrancasNaoMapeadas";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirVisualizacao(user.role, "FINANCEIRO_VER");

    const { searchParams } = new URL(request.url);
    const mes = searchParams.get("mes") ?? undefined;

    const linhas = await listarCobrancasNaoMapeadas(user.contaId, mes);
    return NextResponse.json({ linhas });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao listar cobranças não mapeadas:", error);
    return NextResponse.json({ error: "Erro ao listar cobranças não mapeadas" }, { status: 500 });
  }
}
