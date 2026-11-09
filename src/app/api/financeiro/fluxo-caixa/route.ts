import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { exigirVisualizacao, permissaoErrorResponse } from "@/lib/permissoes";
import { gerarFluxoCaixa, type Granularidade } from "@/modules/financeiro/relatorios/fluxoCaixa";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUserAtivo(request);
    exigirVisualizacao(user.role, "FINANCEIRO_VER");

    const { searchParams } = new URL(request.url);
    const desde = searchParams.get("desde");
    const ate = searchParams.get("ate");
    if (!desde || !ate) {
      return NextResponse.json({ error: "Parâmetros desde e ate são obrigatórios" }, { status: 400 });
    }
    const granularidade = (searchParams.get("granularidade") as Granularidade) || "DIA";

    const fluxo = await gerarFluxoCaixa(user.contaId, new Date(desde), new Date(ate), granularidade);
    return NextResponse.json(fluxo);
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao gerar fluxo de caixa:", error);
    return NextResponse.json({ error: "Erro ao gerar fluxo de caixa" }, { status: 500 });
  }
}
