import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";

type MatchStatus = "matched" | "potential_match" | "similar_found" | "unmatched";

interface LocalMatch {
  id: string;
  nome: string;
  sku: string;
}

/**
 * Sugere produtos locais para um anúncio do ML:
 *  - "potential_match": o SKU de um produto local aparece no título do anúncio
 *  - "similar_found": há sobreposição relevante de palavras entre nome e título
 *  - "unmatched": nenhuma sugestão
 */
function sugerirMatches(
  mlTitle: string,
  locais: LocalMatch[]
): { matches: LocalMatch[]; tipo: MatchStatus } {
  const titulo = (mlTitle || "").toLowerCase();

  // 1) SKU do produto local presente no título do anúncio
  const porSku = locais.filter(
    (p) => p.sku && p.sku.length >= 3 && titulo.includes(p.sku.toLowerCase())
  );
  if (porSku.length > 0) {
    return { matches: porSku.slice(0, 5), tipo: "potential_match" };
  }

  // 2) Similaridade por palavras (>= 2 palavras relevantes em comum)
  const palavrasTitulo = new Set(
    titulo.split(/\s+/).filter((w) => w.length >= 4)
  );
  const porNome = locais
    .map((p) => {
      const comuns = p.nome
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length >= 4 && palavrasTitulo.has(w)).length;
      return { p, comuns };
    })
    .filter((x) => x.comuns >= 2)
    .sort((a, b) => b.comuns - a.comuns)
    .map((x) => x.p);
  if (porNome.length > 0) {
    return { matches: porNome.slice(0, 5), tipo: "similar_found" };
  }

  return { matches: [], tipo: "unmatched" };
}

/**
 * GET /api/mercadolivre/produtos-inteligente?accountId=xxx&mode=smart|unmatched|matched|all
 * Retorna { produtos, summary } no formato consumido por MercadoLivreSmartSync.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const mode = searchParams.get("mode") || "smart";

    if (!accountId) {
      return NextResponse.json(
        { error: "ID da conta não fornecido" },
        { status: 400 }
      );
    }

    const account = await prisma.mercadoLivreAccount.findFirst({
      where: { id: accountId, userId: user.id },
    });
    if (!account) {
      return NextResponse.json(
        { error: "Conta não encontrada" },
        { status: 404 }
      );
    }

    const [mlProdutos, locais] = await Promise.all([
      prisma.produtoMercadoLivre.findMany({
        where: {
          mercadoLivreAccountId: accountId,
          syncStatus: { not: "ignored" },
        },
        include: { produto: { select: { id: true, nome: true, sku: true } } },
        orderBy: { lastSyncAt: "desc" },
      }),
      prisma.produto.findMany({
        where: { userId: user.id },
        select: { id: true, nome: true, sku: true },
      }),
    ]);

    const produtos = mlProdutos.map((ml) => {
      let matchStatus: MatchStatus;
      let localProduct: LocalMatch | undefined;
      let suggestedMatches: LocalMatch[] = [];

      if (ml.produto) {
        matchStatus = "matched";
        localProduct = {
          id: ml.produto.id,
          nome: ml.produto.nome,
          sku: ml.produto.sku,
        };
      } else {
        const sugestao = sugerirMatches(ml.mlTitle, locais);
        matchStatus = sugestao.tipo;
        suggestedMatches = sugestao.matches;
      }

      return {
        mlItemId: ml.mlItemId,
        title: ml.mlTitle,
        price: ml.mlPrice,
        thumbnail: ml.mlThumbnail || undefined,
        permalink: ml.mlPermalink || "",
        status: ml.mlStatus,
        availableQuantity: ml.mlAvailableQuantity,
        soldQuantity: ml.mlSoldQuantity,
        matchStatus,
        localProduct,
        suggestedMatches,
        existingML: {
          id: ml.id,
          syncStatus: ml.syncStatus,
          lastSyncAt: ml.lastSyncAt.toISOString(),
        },
      };
    });

    const filtrados = produtos.filter((p) => {
      if (mode === "matched") return p.matchStatus === "matched";
      if (mode === "unmatched") return p.matchStatus !== "matched";
      return true; // smart / all
    });

    const summary = {
      total: produtos.length,
      processed: produtos.length,
      matched: produtos.filter((p) => p.matchStatus === "matched").length,
      potential_matches: produtos.filter(
        (p) => p.matchStatus === "potential_match"
      ).length,
      similar_found: produtos.filter((p) => p.matchStatus === "similar_found")
        .length,
      unmatched: produtos.filter((p) => p.matchStatus === "unmatched").length,
    };

    return NextResponse.json({ produtos: filtrados, summary });
  } catch (error) {
    console.error("[PRODUTOS_INTELIGENTE][GET] Erro:", error);
    return NextResponse.json(
      { error: "Erro ao carregar produtos" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/mercadolivre/produtos-inteligente
 * body: { accountId, mlItemId, action: "link"|"ignore", localProductId? }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const body = (await request.json()) as {
      accountId?: string;
      mlItemId?: string;
      localProductId?: string;
      action?: string;
    };
    const { accountId, mlItemId, localProductId, action } = body;

    if (!accountId || !mlItemId || !action) {
      return NextResponse.json(
        { error: "Parâmetros insuficientes" },
        { status: 400 }
      );
    }

    const account = await prisma.mercadoLivreAccount.findFirst({
      where: { id: accountId, userId: user.id },
    });
    if (!account) {
      return NextResponse.json(
        { error: "Conta não encontrada" },
        { status: 404 }
      );
    }

    const mlProduto = await prisma.produtoMercadoLivre.findFirst({
      where: { mlItemId, mercadoLivreAccountId: accountId },
    });
    if (!mlProduto) {
      return NextResponse.json(
        { error: "Anúncio não encontrado" },
        { status: 404 }
      );
    }

    if (action === "link") {
      if (!localProductId) {
        return NextResponse.json(
          { error: "Produto local não informado" },
          { status: 400 }
        );
      }
      // Garantir que o produto local pertence ao usuário
      const local = await prisma.produto.findFirst({
        where: { id: localProductId, userId: user.id },
      });
      if (!local) {
        return NextResponse.json(
          { error: "Produto local não encontrado" },
          { status: 404 }
        );
      }
      await prisma.produtoMercadoLivre.update({
        where: { id: mlProduto.id },
        data: { produtoId: localProductId, syncStatus: "synced" },
      });
      return NextResponse.json({ success: true });
    }

    if (action === "ignore") {
      await prisma.produtoMercadoLivre.update({
        where: { id: mlProduto.id },
        data: { syncStatus: "ignored" },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (error) {
    console.error("[PRODUTOS_INTELIGENTE][POST] Erro:", error);
    return NextResponse.json(
      { error: "Erro ao processar ação" },
      { status: 500 }
    );
  }
}
