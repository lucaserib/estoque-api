import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { exigirPermissao, permissaoErrorResponse } from "@/lib/permissoes";
import { normalizeSku } from "@/lib/sku";
import { mlCache, createCacheKey } from "@/lib/cache";
import {
  confirmarVinculoAnuncio,
  definirVinculoAnuncio,
  descreverComposicao,
  INCLUDE_COMPOSICAO,
  VinculoErro,
} from "@/modules/catalogo/vinculos";

type MotivoPendencia = "NAO_CONFIRMADO" | "SKU_DIVERGENTE";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "EDITAR_PRODUTO");

    const vinculos = await prisma.produtoMercadoLivre.findMany({
      where: {
        mercadoLivreAccount: { userId: user.contaId },
        produtoId: { not: null },
      },
      select: {
        id: true,
        mlItemId: true,
        mlTitle: true,
        mlSellerSku: true,
        vinculoOrigem: true,
        vinculoConfirmado: true,
        produto: { select: { id: true, nome: true, sku: true, isKit: true, ...INCLUDE_COMPOSICAO } },
      },
      orderBy: { lastSyncAt: "desc" },
    });

    const pendentes = vinculos
      .map((v) => {
        const motivos: MotivoPendencia[] = [];
        if (!v.vinculoConfirmado) motivos.push("NAO_CONFIRMADO");
        const composicao = v.produto ? descreverComposicao(v.produto) : null;
        const skusAceitos = v.produto && composicao
          ? [normalizeSku(v.produto.sku), normalizeSku(composicao.produtoBaseSku)]
          : [];
        if (v.mlSellerSku && v.produto && !skusAceitos.includes(normalizeSku(v.mlSellerSku))) {
          motivos.push("SKU_DIVERGENTE");
        }
        return { v, motivos };
      })
      .filter(({ motivos }) => motivos.length > 0);

    return NextResponse.json({
      vinculos: pendentes.map(({ v, motivos }) => ({
        id: v.id,
        mlItemId: v.mlItemId,
        mlTitle: v.mlTitle,
        mlSellerSku: v.mlSellerSku,
        origem: v.vinculoOrigem,
        produto: v.produto ? { id: v.produto.id, nome: v.produto.nome, sku: v.produto.sku } : null,
        composicao: v.produto ? descreverComposicao(v.produto) : null,
        motivos,
      })),
    });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao listar vínculos pendentes de confirmação:", error);
    return NextResponse.json({ error: "Erro ao listar vínculos pendentes" }, { status: 500 });
  }
}

interface RequestBody {
  id?: string;
  acao?: "confirmar" | "rejeitar" | "trocar";
  novoProdutoId?: string;
  unidadesPorVenda?: number;
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "EDITAR_PRODUTO");

    const body: RequestBody = await request.json();
    if (!body.id || !body.acao) {
      return NextResponse.json({ error: "id e acao são obrigatórios" }, { status: 400 });
    }

    if (body.acao === "confirmar") {
      await confirmarVinculoAnuncio(user.contaId, body.id);
    } else if (body.acao === "rejeitar") {
      await definirVinculoAnuncio({ contaId: user.contaId, anuncioId: body.id, produtoId: null });
    } else {
      if (!body.novoProdutoId) {
        return NextResponse.json({ error: "novoProdutoId é obrigatório para trocar o vínculo" }, { status: 400 });
      }
      await definirVinculoAnuncio({
        contaId: user.contaId,
        anuncioId: body.id,
        produtoId: body.novoProdutoId,
        unidadesPorVenda: body.unidadesPorVenda ?? 1,
      });
    }
    await mlCache.delete(createCacheKey("pendencias", user.contaId));

    return NextResponse.json({ status: "OK" });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;
    if (error instanceof VinculoErro) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Erro ao confirmar/rejeitar/trocar vínculo:", error);
    return NextResponse.json({ error: "Erro ao atualizar vínculo" }, { status: 500 });
  }
}
