import { NextRequest, NextResponse } from "next/server";
import { CanalVenda } from "@prisma/client";
import { verifyUser } from "@/helpers/verifyUser";
import { exigirVisualizacao, permissaoErrorResponse } from "@/lib/permissoes";
import { gerarSerieDiaria } from "@/modules/financeiro/relatorios/resumoDia";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirVisualizacao(user.role, "FINANCEIRO_VER");

    const { searchParams } = new URL(request.url);
    const desde = searchParams.get("desde");
    const ate = searchParams.get("ate");
    if (!desde || !ate) {
      return NextResponse.json({ error: "Parâmetros desde e ate são obrigatórios" }, { status: 400 });
    }
    const canal = (searchParams.get("canal") as CanalVenda) || undefined;

    const serie = await gerarSerieDiaria(user.contaId, new Date(desde), new Date(ate), canal);
    return NextResponse.json({ pontos: serie });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao gerar série diária:", error);
    return NextResponse.json({ error: "Erro ao gerar série diária" }, { status: 500 });
  }
}
