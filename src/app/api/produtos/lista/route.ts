import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { podeVer, permissaoErrorResponse } from "@/lib/permissoes";
import {
  listarProdutos,
  type FiltroEstoque,
  type FiltroMl,
  type FiltroStatus,
  type FiltroTipo,
  type OrdemLista,
} from "@/modules/catalogo/listaProdutos";

function opcao<T extends string>(valor: string | null, permitidos: readonly T[], padrao: T): T {
  return valor && (permitidos as readonly string[]).includes(valor) ? (valor as T) : padrao;
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUserAtivo(request);
    const sp = new URL(request.url).searchParams;

    const resultado = await listarProdutos(user.contaId, {
      q: sp.get("q")?.slice(0, 100) || undefined,
      status: opcao<FiltroStatus>(sp.get("status"), ["ativos", "inativos", "todos"], "ativos"),
      tipo: opcao<FiltroTipo>(sp.get("tipo"), ["produtos", "kits", "todos"], "produtos"),
      estoque: opcao<FiltroEstoque>(sp.get("estoque"), ["all", "available", "low", "none"], "all"),
      ml: opcao<FiltroMl>(sp.get("ml"), ["all", "linked", "unlinked"], "all"),
      fornecedorId: sp.get("fornecedorId") || undefined,
      pendencia: sp.get("pendencia") || undefined,
      ordem: opcao<OrdemLista>(sp.get("ordem"), ["relevancia", "nome", "estoque", "vendas"], "relevancia"),
      pagina: Number(sp.get("pagina")) || 1,
      porPagina: Number(sp.get("porPagina")) || 30,
    });

    if (!podeVer(user.role, "VER_CUSTO")) {
      for (const item of resultado.itens) item.custoMedio = null;
    }

    return NextResponse.json(resultado);
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    console.error("[PRODUTOS_LISTA] Erro:", error);
    return NextResponse.json({ error: "Erro ao listar produtos" }, { status: 500 });
  }
}
