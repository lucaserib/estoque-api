import { NextRequest, NextResponse } from "next/server";
import { CanalVenda, StatusVendaCanal } from "@prisma/client";
import { verifyUser } from "@/helpers/verifyUser";
import { exigirVisualizacao, permissaoErrorResponse } from "@/lib/permissoes";
import { listarVendasComLucro } from "@/modules/financeiro/relatorios/lucroPorVenda";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirVisualizacao(user.role, "FINANCEIRO_VER");

    const { searchParams } = new URL(request.url);
    const desde = searchParams.get("desde");
    const ate = searchParams.get("ate");

    const resultado = await listarVendasComLucro(user.contaId, {
      desde: desde ? new Date(desde) : undefined,
      ate: ate ? new Date(ate) : undefined,
      canal: (searchParams.get("canal") as CanalVenda) || undefined,
      status: (searchParams.get("status") as StatusVendaCanal) || undefined,
      soPrejuizo: searchParams.get("soPrejuizo") === "true",
      soIncompletas: searchParams.get("soIncompletas") === "true",
      produtoId: searchParams.get("produtoId") || undefined,
      logistica: searchParams.get("logistica") || undefined,
      pagina: searchParams.get("pagina") ? Number(searchParams.get("pagina")) : undefined,
      porPagina: searchParams.get("porPagina") ? Number(searchParams.get("porPagina")) : undefined,
    });

    return NextResponse.json(resultado);
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao listar vendas com lucro:", error);
    return NextResponse.json({ error: "Erro ao listar vendas" }, { status: 500 });
  }
}
