import { NextRequest, NextResponse } from "next/server";
import { CanalVenda } from "@prisma/client";
import { verifyUser } from "@/helpers/verifyUser";
import { exigirVisualizacao, permissaoErrorResponse } from "@/lib/permissoes";
import { gerarResumoDia } from "@/modules/financeiro/relatorios/resumoDia";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirVisualizacao(user.role, "FINANCEIRO_VER");

    const { searchParams } = new URL(request.url);
    const dia = searchParams.get("dia");
    const canal = (searchParams.get("canal") as CanalVenda) || undefined;

    const resumo = await gerarResumoDia(user.contaId, dia ? new Date(dia) : new Date(), canal);
    return NextResponse.json(resumo);
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao gerar resumo do dia:", error);
    return NextResponse.json({ error: "Erro ao gerar resumo do dia" }, { status: 500 });
  }
}
