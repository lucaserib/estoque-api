import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { ProductMatchingService } from "@/services/productMatchingService";

/**
 * POST /api/produtos/matching
 * Executa matching automático entre produtos locais e ML
 */
export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const body = await request.json();
    const { mlAccountId, autoApply = false } = body;

    if (!mlAccountId) {
      return NextResponse.json(
        { error: "ID da conta ML não fornecido" },
        { status: 400 }
      );
    }

    console.log("[MATCHING] Iniciando processo de matching...");

    // Executar matching
    const matches = await ProductMatchingService.matchProducts(
      user.id,
      mlAccountId
    );

    console.log(`[MATCHING] ${matches.length} matches encontrados`);

    // Se autoApply = true, aplicar matches automáticos
    let applyResult;
    if (autoApply) {
      console.log("[MATCHING] Aplicando matches automáticos...");
      applyResult = await ProductMatchingService.applyMatches(
        matches,
        mlAccountId
      );
    }

    // Separar por tipo e status
    const summary = {
      total: matches.length,
      byType: {
        ean: matches.filter((m) => m.matchType === "ean").length,
        sku: matches.filter((m) => m.matchType === "sku").length,
        fuzzy: matches.filter((m) => m.matchType === "fuzzy").length,
      },
      byStatus: {
        matched: matches.filter((m) => m.status === "matched").length,
        pendingReview: matches.filter((m) => m.status === "pending_review")
          .length,
      },
      applied: applyResult || null,
    };

    return NextResponse.json({
      success: true,
      summary,
      matches: matches.map((m) => ({
        ...m,
        localProduct: {
          ...m.localProduct,
          ean: m.localProduct.ean?.toString() || null,
        },
      })),
    });
  } catch (error) {
    console.error("Erro no matching de produtos:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro no matching de produtos",
      },
      { status: 500 }
    );
  }
}
