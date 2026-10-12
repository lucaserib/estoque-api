import { NextRequest, NextResponse } from "next/server";
import { GrupoDre } from "@prisma/client";
import { verifyUser } from "@/helpers/verifyUser";
import { exigirPermissao, exigirVisualizacao, permissaoErrorResponse } from "@/lib/permissoes";
import { criarCategoria, listarCategorias } from "@/modules/financeiro/lancamentos/categorias";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirVisualizacao(user.role, "FINANCEIRO_VER");

    const { searchParams } = new URL(request.url);
    const incluirInativas = searchParams.get("incluirInativas") === "true";

    const categorias = await listarCategorias(user.contaId, incluirInativas);
    return NextResponse.json({ categorias });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao listar categorias:", error);
    return NextResponse.json({ error: "Erro ao listar categorias" }, { status: 500 });
  }
}

interface RequestBody {
  nome?: string;
  grupoDre?: GrupoDre;
  paiId?: string | null;
  ordem?: number;
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "FINANCEIRO_EDITAR");

    const body: RequestBody = await request.json();
    if (!body.nome || !body.grupoDre) {
      return NextResponse.json({ error: "nome e grupoDre são obrigatórios" }, { status: 400 });
    }

    const categoria = await criarCategoria(user.contaId, {
      nome: body.nome,
      grupoDre: body.grupoDre,
      paiId: body.paiId,
      ordem: body.ordem,
    });
    return NextResponse.json(categoria, { status: 201 });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao criar categoria:", error);
    return NextResponse.json({ error: "Erro ao criar categoria" }, { status: 500 });
  }
}
