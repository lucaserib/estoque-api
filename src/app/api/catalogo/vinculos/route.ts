import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyUser } from "@/helpers/verifyUser";
import { exigirPermissao, permissaoErrorResponse } from "@/lib/permissoes";
import { mlCache, createCacheKey } from "@/lib/cache";
import {
  definirVinculoAnuncio,
  UNIDADES_POR_VENDA_MAXIMO,
  VinculoErro,
} from "@/modules/catalogo/vinculos";

const corpoSchema = z
  .object({
    anuncioId: z.string().min(1).optional(),
    accountId: z.string().min(1).optional(),
    mlItemId: z.string().min(1).optional(),
    produtoId: z.string().min(1).nullable(),
    unidadesPorVenda: z.number().int().min(1).max(UNIDADES_POR_VENDA_MAXIMO).optional(),
  })
  .refine((c) => c.anuncioId || (c.accountId && c.mlItemId), {
    message: "Informe o anúncio (anuncioId ou accountId + mlItemId)",
  });

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "EDITAR_PRODUTO");

    const parsed = corpoSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
    }
    const corpo = parsed.data;

    const resultado = await definirVinculoAnuncio({
      contaId: user.contaId,
      anuncioId: corpo.anuncioId,
      mercadoLivreAccountId: corpo.accountId,
      mlItemId: corpo.mlItemId,
      produtoId: corpo.produtoId,
      unidadesPorVenda: corpo.unidadesPorVenda,
    });

    await mlCache.delete(createCacheKey("pendencias", user.contaId));

    return NextResponse.json(resultado);
  } catch (error) {
    const permissao = permissaoErrorResponse(error);
    if (permissao) return permissao;
    if (error instanceof VinculoErro) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[CATALOGO_VINCULOS] Erro:", error);
    return NextResponse.json({ error: "Erro ao salvar o vínculo" }, { status: 500 });
  }
}
