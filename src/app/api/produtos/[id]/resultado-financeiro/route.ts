import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { gerarLucroPorProduto } from "@/modules/financeiro/relatorios/lucroPorProduto";
import { listarVendasComLucro } from "@/modules/financeiro/relatorios/lucroPorVenda";

const TRINTA_DIAS_MS = 30 * 24 * 60 * 60 * 1000;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyUser(request);
    const { id } = await params;

    const ate = new Date();
    const desde = new Date(ate.getTime() - TRINTA_DIAS_MS);

    const [linhas, vendasIncompletas] = await Promise.all([
      gerarLucroPorProduto(user.contaId, { desde, ate }),
      listarVendasComLucro(user.contaId, {
        desde,
        ate,
        produtoId: id,
        soIncompletas: true,
        porPagina: 1,
      }),
    ]);

    const linha = linhas.find((l) => l.produtoId === id);

    return NextResponse.json({
      desde: desde.toISOString(),
      ate: ate.toISOString(),
      unidades: linha?.unidades ?? 0,
      margemContribuicao: linha?.margemContribuicao ?? 0,
      lucroLiquido: linha?.lucroLiquido ?? 0,
      vendasIncompletas: vendasIncompletas.total,
    });
  } catch (error) {
    console.error("Erro ao calcular resultado financeiro do produto:", error);
    return NextResponse.json(
      { error: "Erro ao calcular resultado financeiro do produto" },
      { status: 500 }
    );
  }
}
