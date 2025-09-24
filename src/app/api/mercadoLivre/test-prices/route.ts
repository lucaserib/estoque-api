import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { exibirValorEmReais } from "@/utils/currency";

/**
 * API DE TESTE para validar consistência de preços
 * Compara valores antes e depois das correções
 */
export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId é obrigatório" },
        { status: 400 }
      );
    }

    console.log(`[TEST_PRICES] Iniciando teste de consistência de preços...`);

    // ✅ BUSCAR: Alguns produtos para teste
    const produtos = await prisma.produtoMercadoLivre.findMany({
      where: {
        mercadoLivreAccountId: accountId,
        mlStatus: "active",
      },
      select: {
        mlItemId: true,
        mlTitle: true,
        mlPrice: true, // Deve estar em centavos
        mlOriginalPrice: true, // Deve estar em centavos
        mlHasPromotion: true,
        mlPromotionDiscount: true,
        mlSoldQuantity: true,
      },
      take: 10, // Apenas 10 para teste
    });

    console.log(`[TEST_PRICES] Testando ${produtos.length} produtos...`);

    // ✅ ANÁLISE: Verificar consistência
    const resultados = produtos.map((produto) => {
      const precoAtualReais = exibirValorEmReais(produto.mlPrice);
      const precoOriginalReais = produto.mlOriginalPrice
        ? exibirValorEmReais(produto.mlOriginalPrice)
        : null;

      // ✅ VALIDAÇÃO: Verificar se valores são sensatos
      const precoEmCentavos = produto.mlPrice;
      const isSensible = precoEmCentavos >= 100 && precoEmCentavos <= 1000000; // Entre R$ 1,00 e R$ 10.000,00

      // ✅ CÁLCULO: Verificar desconto manual
      let descontoCalculado = 0;
      if (
        produto.mlHasPromotion &&
        produto.mlOriginalPrice &&
        produto.mlPrice
      ) {
        descontoCalculado = Math.round(
          ((produto.mlOriginalPrice - produto.mlPrice) /
            produto.mlOriginalPrice) *
            100
        );
      }

      return {
        item: {
          id: produto.mlItemId,
          titulo: produto.mlTitle?.substring(0, 50) + "...",
        },
        precos: {
          atual: {
            centavos: produto.mlPrice,
            reais: precoAtualReais,
            sensato: isSensible,
          },
          original: produto.mlOriginalPrice
            ? {
                centavos: produto.mlOriginalPrice,
                reais: precoOriginalReais,
              }
            : null,
        },
        promocao: {
          tem: produto.mlHasPromotion,
          descontoBD: produto.mlPromotionDiscount,
          descontoCalculado,
          consistente: produto.mlPromotionDiscount === descontoCalculado,
        },
        vendas: {
          quantidade: produto.mlSoldQuantity,
          temVendas: produto.mlSoldQuantity > 0,
        },
        status: {
          precoOK: isSensible,
          promocaoOK:
            !produto.mlHasPromotion ||
            produto.mlPromotionDiscount === descontoCalculado,
          vendasOK: typeof produto.mlSoldQuantity === "number",
        },
      };
    });

    // ✅ RESUMO: Estatísticas gerais
    const stats = {
      total: resultados.length,
      precosOK: resultados.filter((r) => r.status.precoOK).length,
      promocoesOK: resultados.filter((r) => r.status.promocaoOK).length,
      vendasOK: resultados.filter((r) => r.status.vendasOK).length,
      comPromocao: resultados.filter((r) => r.promocao.tem).length,
      comVendas: resultados.filter((r) => r.vendas.temVendas).length,
    };

    // ✅ PROBLEMAS: Identificar inconsistências
    const problemas = resultados.filter(
      (r) => !r.status.precoOK || !r.status.promocaoOK || !r.status.vendasOK
    );

    console.log(
      `[TEST_PRICES] ✅ Teste concluído: ${stats.precosOK}/${stats.total} preços OK`
    );

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      estatisticas: stats,
      saude: {
        precos: Math.round((stats.precosOK / stats.total) * 100) + "%",
        promocoes: Math.round((stats.promocoesOK / stats.total) * 100) + "%",
        vendas: Math.round((stats.vendasOK / stats.total) * 100) + "%",
        geral:
          Math.round(
            ((stats.precosOK + stats.promocoesOK + stats.vendasOK) /
              (stats.total * 3)) *
              100
          ) + "%",
      },
      amostras: resultados.slice(0, 5), // Primeiras 5 para visualização
      problemas: problemas.length > 0 ? problemas.slice(0, 3) : [], // Até 3 problemas
      recomendacoes: [
        stats.precosOK < stats.total
          ? "⚠️ Alguns preços podem estar em formato incorreto"
          : "✅ Preços em formato correto",
        stats.promocoesOK < stats.total
          ? "⚠️ Descontos promocionais inconsistentes"
          : "✅ Promoções consistentes",
        stats.vendasOK < stats.total
          ? "⚠️ Dados de vendas inconsistentes"
          : "✅ Dados de vendas OK",
        stats.comVendas === 0
          ? "⚠️ Nenhum produto com vendas registradas"
          : `✅ ${stats.comVendas} produtos com vendas`,
      ],
    });
  } catch (error) {
    console.error("[TEST_PRICES] Erro:", error);
    return NextResponse.json(
      {
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}
