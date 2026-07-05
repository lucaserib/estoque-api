import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { MercadoLivreService } from "@/services/mercadoLivreService";

/**
 * API CORRIGIDA para sugestões de reposição
 * Elimina erros Prisma e melhora performance
 */
export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const period = parseInt(searchParams.get("period") || "30");

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId é obrigatório" },
        { status: 400 }
      );
    }

    console.log(`[RESTOCK_FIXED] Iniciando análise para ${period} dias`);

    const account = await prisma.mercadoLivreAccount.findFirst({
      where: { id: accountId, userId: user.id, isActive: true },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Conta não encontrada" },
        { status: 404 }
      );
    }

    try {
      const accessToken = await MercadoLivreService.getValidToken(accountId);

      // ✅ CORREÇÃO: Query Prisma simplificada e segura
      console.log(`[RESTOCK_FIXED] Buscando produtos vinculados...`);

      const produtosML = await prisma.produtoMercadoLivre.findMany({
        where: {
          mercadoLivreAccountId: accountId,
          mlStatus: "active",
          // ✅ CORREÇÃO: Usar sintaxe simples para evitar erros
          produtoId: { not: null },
        },
        include: {
          produto: {
            include: {
              estoques: {
                include: {
                  armazem: true,
                },
              },
              fornecedores: {
                include: {
                  fornecedor: true,
                },
                take: 1,
              },
            },
          },
        },
        take: 100, // ✅ PERFORMANCE: Limitar resultados
      });

      console.log(
        `[RESTOCK_FIXED] ✅ ${produtosML.length} produtos encontrados`
      );

      if (produtosML.length === 0) {
        return NextResponse.json({
          success: true,
          message: "Nenhum produto vinculado encontrado",
          suggestions: [],
        });
      }

      // ✅ PROCESSAMENTO: Calcular sugestões de reposição
      const suggestions = [];

      for (const produtoML of produtosML) {
        if (!produtoML.produto) continue;

        try {
          // Calcular estoque total
          const estoqueTotal = produtoML.produto.estoques.reduce(
            (total, estoque) => total + estoque.quantidade,
            0
          );

          // Obter dados de vendas (últimos 30 dias)
          const vendas30d = produtoML.mlSoldQuantity || 0;
          const mediaDiaria = vendas30d / 30;
          const estoqueSeguranca = Math.ceil(mediaDiaria * 7); // 7 dias de segurança

          // ✅ LÓGICA: Determinar necessidade de reposição
          const necessidadeReposicao = estoqueSeguranca - estoqueTotal;
          const diasRestantes =
            estoqueTotal > 0
              ? Math.floor(estoqueTotal / (mediaDiaria || 1))
              : 0;

          // Apenas produtos que precisam de reposição
          if (necessidadeReposicao > 0 || diasRestantes <= 7) {
            const fornecedor = produtoML.produto.fornecedores[0]?.fornecedor;

            suggestions.push({
              // Produto info
              produtoId: produtoML.produto.id,
              produtoNome: produtoML.produto.nome,
              produtoSku: produtoML.produto.sku,

              // ML info
              mlItemId: produtoML.mlItemId,
              mlTitle: produtoML.mlTitle,
              mlPrice: produtoML.mlPrice,
              mlAvailableQuantity: produtoML.mlAvailableQuantity,

              // Estoque info
              estoqueAtual: estoqueTotal,
              estoqueMl: produtoML.mlAvailableQuantity,

              // Vendas info
              vendas30d,
              mediaDiariaVendas: Math.round(mediaDiaria * 100) / 100,

              // Recomendações
              estoqueSeguranca,
              necessidadeReposicao: Math.max(0, necessidadeReposicao),
              diasRestantes,
              prioridade:
                diasRestantes <= 3
                  ? "alta"
                  : diasRestantes <= 7
                  ? "media"
                  : "baixa",

              // Fornecedor
              fornecedor: fornecedor
                ? {
                    id: fornecedor.id,
                    nome: fornecedor.nome,
                    contato: fornecedor.contato || "",
                  }
                : null,

              // Status
              status:
                diasRestantes <= 3
                  ? "crítico"
                  : diasRestantes <= 7
                  ? "atenção"
                  : "monitorar",

              // Sugestão de compra
              sugestaoCompra: Math.max(necessidadeReposicao, mediaDiaria * 15), // 15 dias de estoque
            });
          }
        } catch (produtoError) {
          console.warn(
            `[RESTOCK_FIXED] Erro ao processar ${produtoML.produto.nome}:`,
            produtoError
          );
        }
      }

      // ✅ ORDENAÇÃO: Por prioridade e dias restantes
      suggestions.sort((a, b) => {
        const prioridadeOrder = { alta: 3, media: 2, baixa: 1 };
        const prioA =
          prioridadeOrder[a.prioridade as keyof typeof prioridadeOrder] || 0;
        const prioB =
          prioridadeOrder[b.prioridade as keyof typeof prioridadeOrder] || 0;

        if (prioA !== prioB) return prioB - prioA;
        return a.diasRestantes - b.diasRestantes;
      });

      console.log(`[RESTOCK_FIXED] ✅ ${suggestions.length} sugestões geradas`);

      return NextResponse.json({
        success: true,
        period: `${period} dias`,
        summary: {
          totalProdutos: produtosML.length,
          sugestoes: suggestions.length,
          criticos: suggestions.filter((s) => s.status === "crítico").length,
          atencao: suggestions.filter((s) => s.status === "atenção").length,
          monitorar: suggestions.filter((s) => s.status === "monitorar").length,
        },
        suggestions: suggestions.slice(0, 50), // ✅ PERFORMANCE: Limitar resultados
        metadata: {
          generatedAt: new Date().toISOString(),
          account: account.nickname,
          criteria: {
            diasSeguranca: 7,
            diasCompra: 15,
            baseCalculo: "vendas últimos 30 dias",
          },
        },
      });
    } catch (mlError) {
      console.error("[RESTOCK_FIXED] Erro ML:", mlError);
      return NextResponse.json(
        { error: "Erro ao acessar dados do Mercado Livre" },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("[RESTOCK_FIXED] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
