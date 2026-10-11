import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { exigirVisualizacao, permissaoErrorResponse } from "@/lib/permissoes";
import { obterDetalheVenda, VendaNaoEncontradaError } from "@/modules/financeiro/relatorios/lucroPorVenda";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyUser(request);
    exigirVisualizacao(user.role, "FINANCEIRO_VER");
    const { id } = await params;

    const venda = await obterDetalheVenda(user.contaId, id);
    return NextResponse.json(venda);
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;
    if (error instanceof VendaNaoEncontradaError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error("Erro ao obter detalhe da venda:", error);
    return NextResponse.json({ error: "Erro ao obter detalhe da venda" }, { status: 500 });
  }
}
