import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { exigirVisualizacao, permissaoErrorResponse } from "@/lib/permissoes";
import { gerarSaldoProjetado } from "@/modules/financeiro/relatorios/fluxoCaixa";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirVisualizacao(user.role, "FINANCEIRO_VER");

    const { searchParams } = new URL(request.url);
    const diasParam = Number(searchParams.get("dias") ?? "30");
    const dias = diasParam === 60 ? 60 : diasParam === 90 ? 90 : 30;

    const resultado = await gerarSaldoProjetado(user.contaId, dias);
    return NextResponse.json(resultado);
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao gerar saldo projetado:", error);
    return NextResponse.json({ error: "Erro ao gerar saldo projetado" }, { status: 500 });
  }
}
