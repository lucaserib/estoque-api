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

const ITENS_MAXIMO = 200;

const itemSchema = z.object({
  anuncioId: z.string().min(1),
  produtoId: z.string().min(1).nullable(),
  unidadesPorVenda: z.number().int().min(1).max(UNIDADES_POR_VENDA_MAXIMO).optional(),
});

const corpoSchema = z.object({
  itens: z.array(itemSchema).min(1).max(ITENS_MAXIMO),
});

interface ResultadoItem {
  anuncioId: string;
  ok: boolean;
  erro?: string;
  produtoVinculadoId?: string | null;
  kitCriado?: boolean;
}

/**
 * POST /api/catalogo/vinculos/lote — aplica até 200 vínculos de uma vez
 * (ex.: "Aplicar sugestões selecionadas"). Cada item passa pela mesma
 * `definirVinculoAnuncio` do vínculo único — um item com erro não derruba
 * os demais, o resultado vem item por item.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "EDITAR_PRODUTO");

    const parsed = corpoSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
    }

    const resultados: ResultadoItem[] = [];
    for (const item of parsed.data.itens) {
      try {
        const resultado = await definirVinculoAnuncio({
          contaId: user.contaId,
          anuncioId: item.anuncioId,
          produtoId: item.produtoId,
          unidadesPorVenda: item.unidadesPorVenda,
        });
        resultados.push({
          anuncioId: item.anuncioId,
          ok: true,
          produtoVinculadoId: resultado.produtoVinculadoId,
          kitCriado: resultado.kitCriado,
        });
      } catch (erro) {
        resultados.push({
          anuncioId: item.anuncioId,
          ok: false,
          erro: erro instanceof VinculoErro ? erro.message : "Erro ao salvar o vínculo",
        });
      }
    }

    await mlCache.delete(createCacheKey("pendencias", user.contaId));

    const sucessos = resultados.filter((r) => r.ok).length;
    return NextResponse.json({ resultados, sucessos, falhas: resultados.length - sucessos });
  } catch (error) {
    const permissao = permissaoErrorResponse(error);
    if (permissao) return permissao;
    console.error("[CATALOGO_VINCULOS_LOTE] Erro:", error);
    return NextResponse.json({ error: "Erro ao salvar os vínculos" }, { status: 500 });
  }
}
