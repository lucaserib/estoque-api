import { NextRequest, NextResponse } from "next/server";
import { CanalVenda } from "@prisma/client";
import { verifyUser } from "@/helpers/verifyUser";
import { exigirVisualizacao, permissaoErrorResponse } from "@/lib/permissoes";
import { gerarLucroPorProduto } from "@/modules/financeiro/relatorios/lucroPorProduto";

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

    const ordenarPor = (searchParams.get("ordenarPor") as "margemContribuicao" | "faturamentoBruto" | "lucroLiquido" | "unidades") || undefined;
    const ordem = (searchParams.get("ordem") as "asc" | "desc") || undefined;

    const linhas = await gerarLucroPorProduto(
      user.contaId,
      { desde: new Date(desde), ate: new Date(ate), canal: (searchParams.get("canal") as CanalVenda) || undefined },
      ordenarPor,
      ordem
    );

    return NextResponse.json({ produtos: linhas });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao gerar lucro por produto:", error);
    return NextResponse.json({ error: "Erro ao gerar lucro por produto" }, { status: 500 });
  }
}
