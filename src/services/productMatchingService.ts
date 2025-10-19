import { prisma } from "@/lib/prisma";
import Fuse from "fuse.js";

// ==================== TYPES ====================

export interface MatchResult {
  localProduct: {
    id: string;
    sku: string;
    nome: string;
    ean: string | null;
  };
  mlProduct: {
    mlItemId: string;
    mlTitle: string;
    sellerSku: string | null;
    ean: string | null;
  };
  matchType: "ean" | "sku" | "fuzzy" | "manual";
  confidence: number; // 0-100
  status: "matched" | "pending_review";
}

// ==================== MATCHING SERVICE ====================

export class ProductMatchingService {
  /**
   * Tenta fazer matching automático entre produtos locais e ML
   * Ordem de prioridade: EAN → SKU → Fuzzy Title
   */
  static async matchProducts(
    userId: string,
    mlAccountId: string
  ): Promise<MatchResult[]> {
    // Buscar produtos locais do usuário
    const localProducts = await prisma.produto.findMany({
      where: {
        userId,
        isKit: false, // Não matchear kits automaticamente
      },
      select: {
        id: true,
        sku: true,
        nome: true,
        ean: true,
      },
    });

    // Buscar produtos ML ainda não vinculados
    const mlProducts = await prisma.produtoMercadoLivre.findMany({
      where: {
        mercadoLivreAccountId: mlAccountId,
        OR: [
          { produtoId: null },
          {
            produto: {
              sku: {
                startsWith: "ML_", // Produtos com SKU temporário
              },
            },
          },
        ],
      },
      select: {
        id: true,
        mlItemId: true,
        mlTitle: true,
        produtoId: true,
        produto: {
          select: {
            sku: true,
          },
        },
      },
    });

    const matches: MatchResult[] = [];

    // Buscar atributos ML em paralelo para extrair SELLER_SKU e EAN
    const mlItemsDetails = await Promise.all(
      mlProducts.map(async (mlProduct) => {
        try {
          // Aqui você pode buscar detalhes do ML se necessário
          // Por enquanto, vamos usar dados já sincronizados
          return {
            mlItemId: mlProduct.mlItemId,
            mlTitle: mlProduct.mlTitle,
            sellerSku: mlProduct.produto?.sku?.startsWith("ML_")
              ? null
              : mlProduct.produto?.sku || null,
            ean: null, // TODO: Buscar EAN do ML se disponível
          };
        } catch {
          return {
            mlItemId: mlProduct.mlItemId,
            mlTitle: mlProduct.mlTitle,
            sellerSku: null,
            ean: null,
          };
        }
      })
    );

    // Processar cada produto ML
    for (const mlDetail of mlItemsDetails) {
      let matched = false;

      // 1. MATCHING POR EAN (maior confiança)
      if (mlDetail.ean) {
        const localMatch = localProducts.find(
          (local) => local.ean && local.ean.toString() === mlDetail.ean
        );

        if (localMatch) {
          matches.push({
            localProduct: {
              id: localMatch.id,
              sku: localMatch.sku,
              nome: localMatch.nome,
              ean: localMatch.ean?.toString() || null,
            },
            mlProduct: mlDetail,
            matchType: "ean",
            confidence: 100,
            status: "matched",
          });
          matched = true;
          continue;
        }
      }

      // 2. MATCHING POR SKU (alta confiança)
      if (mlDetail.sellerSku) {
        const localMatch = localProducts.find(
          (local) => local.sku === mlDetail.sellerSku
        );

        if (localMatch) {
          matches.push({
            localProduct: {
              id: localMatch.id,
              sku: localMatch.sku,
              nome: localMatch.nome,
              ean: localMatch.ean?.toString() || null,
            },
            mlProduct: mlDetail,
            matchType: "sku",
            confidence: 95,
            status: "matched",
          });
          matched = true;
          continue;
        }
      }

      // 3. FUZZY MATCHING POR TÍTULO (média confiança - requer revisão)
      if (!matched) {
        const fuzzyMatch = this.fuzzyMatchByTitle(
          mlDetail.mlTitle,
          localProducts
        );

        if (fuzzyMatch && fuzzyMatch.confidence >= 70) {
          matches.push({
            localProduct: fuzzyMatch.product,
            mlProduct: mlDetail,
            matchType: "fuzzy",
            confidence: fuzzyMatch.confidence,
            status: fuzzyMatch.confidence >= 85 ? "matched" : "pending_review",
          });
        }
      }
    }

    return matches;
  }

  /**
   * Fuzzy matching por título usando Fuse.js
   */
  private static fuzzyMatchByTitle(
    mlTitle: string,
    localProducts: Array<{
      id: string;
      sku: string;
      nome: string;
      ean: bigint | null;
    }>
  ): {
    product: {
      id: string;
      sku: string;
      nome: string;
      ean: string | null;
    };
    confidence: number;
  } | null {
    const fuse = new Fuse(localProducts, {
      keys: ["nome"],
      threshold: 0.4, // 0 = perfeito, 1 = qualquer coisa
      includeScore: true,
    });

    const results = fuse.search(mlTitle);

    if (results.length > 0 && results[0].score !== undefined) {
      const bestMatch = results[0];
      // Converter score do Fuse (0-1, menor é melhor) para confidence (0-100, maior é melhor)
      const confidence = Math.round((1 - (bestMatch.score || 0)) * 100);

      return {
        product: {
          id: bestMatch.item.id,
          sku: bestMatch.item.sku,
          nome: bestMatch.item.nome,
          ean: bestMatch.item.ean?.toString() || null,
        },
        confidence,
      };
    }

    return null;
  }

  /**
   * Aplica matches automáticos (vincula produtos)
   */
  static async applyMatches(
    matches: MatchResult[],
    mlAccountId: string
  ): Promise<{
    success: number;
    errors: number;
    details: string[];
  }> {
    let success = 0;
    let errors = 0;
    const details: string[] = [];

    for (const match of matches) {
      try {
        // Verificar se é match automático (alta confiança)
        if (match.status === "matched" && match.confidence >= 85) {
          // Buscar ou criar ProdutoMercadoLivre
          const existingML = await prisma.produtoMercadoLivre.findFirst({
            where: {
              mlItemId: match.mlProduct.mlItemId,
              mercadoLivreAccountId: mlAccountId,
            },
          });

          if (existingML) {
            // Atualizar vinculação
            await prisma.produtoMercadoLivre.update({
              where: { id: existingML.id },
              data: {
                produtoId: match.localProduct.id,
                syncStatus: "matched",
              },
            });

            success++;
            details.push(
              `✅ ${match.localProduct.sku} ↔ ${match.mlProduct.mlItemId} (${match.matchType})`
            );
          }
        }
      } catch (error) {
        errors++;
        details.push(
          `❌ Erro ao vincular ${match.localProduct.sku}: ${
            error instanceof Error ? error.message : "Erro desconhecido"
          }`
        );
      }
    }

    return { success, errors, details };
  }

  /**
   * Calcula similaridade entre dois textos (simples, sem biblioteca)
   */
  private static calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 100;

    // Levenshtein distance simplificado
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 100;

    const editDistance = this.levenshteinDistance(longer, shorter);
    const similarity = ((longer.length - editDistance) / longer.length) * 100;

    return Math.round(similarity);
  }

  /**
   * Calcula distância de Levenshtein (edit distance)
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }
}
