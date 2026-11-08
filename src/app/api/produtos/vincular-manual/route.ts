import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { exigirPermissao, permissaoErrorResponse } from "@/lib/permissoes";
import { mlCache, createCacheKey } from "@/lib/cache";
import { definirVinculoAnuncio, VinculoErro } from "@/modules/catalogo/vinculos";

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "EDITAR_PRODUTO");
    const { mlProductId, localProductId, unidadesPorVenda } = await request.json();

    if (!mlProductId || !localProductId) {
      return NextResponse.json({ error: "IDs do produto ML e local são obrigatórios" }, { status: 400 });
    }

    const resultado = await definirVinculoAnuncio({
      contaId: user.contaId,
      anuncioId: mlProductId,
      produtoId: localProductId,
      unidadesPorVenda: typeof unidadesPorVenda === "number" ? unidadesPorVenda : 1,
    });
    await mlCache.delete(createCacheKey("pendencias", user.contaId));

    return NextResponse.json({
      success: true,
      message: "Produto vinculado com sucesso",
      data: { ...resultado, stockSynced: false },
    });
  } catch (error) {
    const permissao = permissaoErrorResponse(error);
    if (permissao) return permissao;
    if (error instanceof VinculoErro) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Erro ao vincular produto:", error);
    return NextResponse.json({ error: "Erro ao vincular produto" }, { status: 500 });
  }
}
