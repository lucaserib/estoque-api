import { NextRequest, NextResponse } from "next/server";
import { CanalVenda } from "@prisma/client";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { exigirVisualizacao, permissaoErrorResponse } from "@/lib/permissoes";
import { calcularResumoPorLogistica } from "@/modules/financeiro/relatorios/porLogistica";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUserAtivo(request);
    exigirVisualizacao(user.role, "FINANCEIRO_VER");

    const { searchParams } = new URL(request.url);
    const desde = searchParams.get("desde");
    const ate = searchParams.get("ate");
    const canal = (searchParams.get("canal") as CanalVenda) || undefined;

    if (!desde || !ate) {
      return NextResponse.json({ error: "Parâmetros desde e ate são obrigatórios" }, { status: 400 });
    }

    const resumo = await calcularResumoPorLogistica(user.contaId, new Date(desde), new Date(ate), canal);
    return NextResponse.json({ resumo });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao calcular resumo por logística:", error);
    return NextResponse.json({ error: "Erro ao calcular resumo por logística" }, { status: 500 });
  }
}
