import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { exigirPermissao, permissaoErrorResponse } from "@/lib/permissoes";
import { mlCache, createCacheKey } from "@/lib/cache";
import { definirVinculoAnuncio, VinculoErro } from "@/modules/catalogo/vinculos";

/**
 * Mantida por compatibilidade — a regra vive em `modules/catalogo/vinculos.ts`
 * (POST /api/catalogo/vinculos). Não envia mais estoque ao ML na hora do
 * vínculo: o envio automático já trata Full (nunca envia) e kit (divide pelo
 * componente); aqui somava até o armazém Full e zerava anúncio de kit.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "EDITAR_PRODUTO");
    const { accountId, mlItemId, localProductId, unidadesPorVenda } = await request.json();

    if (!accountId || !mlItemId || !localProductId) {
      return NextResponse.json({ error: "Dados obrigatórios não fornecidos" }, { status: 400 });
    }

    const resultado = await definirVinculoAnuncio({
      contaId: user.contaId,
      mercadoLivreAccountId: accountId,
      mlItemId,
      produtoId: localProductId,
      unidadesPorVenda: typeof unidadesPorVenda === "number" ? unidadesPorVenda : 1,
    });
    await mlCache.delete(createCacheKey("pendencias", user.contaId));

    return NextResponse.json({ success: true, message: "Produto vinculado com sucesso", ...resultado });
  } catch (error) {
    const permissao = permissaoErrorResponse(error);
    if (permissao) return permissao;
    if (error instanceof VinculoErro) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Erro ao vincular produto:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
