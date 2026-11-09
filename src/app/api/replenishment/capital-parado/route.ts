import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { podeVer, permissaoErrorResponse } from "@/lib/permissoes";
import { calcularCapitalParadoConta } from "@/services/reposicaoService";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUserAtivo(request);
    const { searchParams } = new URL(request.url);
    const limiteDias = Number(searchParams.get("limiteDias") ?? "60");
    const verCusto = podeVer(user.role, "VER_CUSTO");

    const produtos = await calcularCapitalParadoConta(user.contaId, limiteDias);

    const valorTotalParado = produtos.reduce((sum, p) => sum + (p.valorParado ?? 0), 0);

    return NextResponse.json({
      produtos: produtos.map((p) => ({
        ...p,
        custoMedio: verCusto ? p.custoMedio : null,
        valorParado: verCusto ? p.valorParado : null,
      })),
      valorTotalParado: verCusto ? valorTotalParado : null,
      limiteDias,
    });
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    console.error("Erro ao calcular capital parado:", error);
    return NextResponse.json(
      { error: "Erro ao calcular capital parado" },
      { status: 500 }
    );
  }
}
