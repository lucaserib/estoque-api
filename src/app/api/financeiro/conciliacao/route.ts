import { NextRequest, NextResponse } from "next/server";
import { CanalVenda } from "@prisma/client";
import { verifyUser } from "@/helpers/verifyUser";
import { exigirVisualizacao, permissaoErrorResponse } from "@/lib/permissoes";
import { gerarRelatorioConciliacao } from "@/modules/financeiro/relatorios/conciliacao";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirVisualizacao(user.role, "FINANCEIRO_VER");

    const { searchParams } = new URL(request.url);
    const mes = searchParams.get("mes");
    const canal = (searchParams.get("canal") ?? CanalVenda.MERCADO_LIVRE) as CanalVenda;

    if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
      return NextResponse.json(
        { error: "Parâmetro mes é obrigatório no formato AAAA-MM" },
        { status: 400 }
      );
    }

    const relatorio = await gerarRelatorioConciliacao(user.contaId, canal, mes);
    return NextResponse.json(relatorio);
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao gerar relatório de conciliação:", error);
    return NextResponse.json(
      { error: "Erro ao gerar relatório de conciliação" },
      { status: 500 }
    );
  }
}
