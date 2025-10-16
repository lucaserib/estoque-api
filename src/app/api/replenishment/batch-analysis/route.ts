import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { MercadoLivreService } from "@/services/mercadoLivreService";

/**
 * Análise em lote de reposição
 * Retorna todos os produtos que precisam de reposição (crítico ou atenção)
 */

interface BatchAnalysisResult {
  produtoId: string;
  produtoNome: string;
  sku: string;
  custoMedio: number;
  tipoAnuncio: "full" | "local" | "ambos";
  estoqueLocal: number;
  estoqueFull: number;
  estoqueTotal: number;
  mediaVendasPeriodo: number;
  mediaDiaria: number;
  analysisPeriodDays: number;
  statusGeral: "ok" | "atencao" | "critico";
  reposicaoFull: {
    necessaria: boolean;
    quantidadeSugerida: number;
    diasRestantes: number;
    status: "ok" | "atencao" | "critico";
    custoTotal: number;
  } | null;
  reposicaoLocal: {
    necessaria: boolean;
    quantidadeSugerida: number;
    diasRestantes: number;
    status: "ok" | "atencao" | "critico";
    custoTotal: number;
  };
  custoTotalReposicao: number;
}

/**
 * GET /api/replenishment/batch-analysis
 * Analisa todos os produtos e retorna apenas os que precisam de reposição
 */
export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);

    console.log("[BATCH_ANALYSIS] Iniciando análise em lote de reposição");

    // 1. Buscar todos os produtos do usuário
    const produtos = await prisma.produto.findMany({
      where: {
        userId: user.id,
        isKit: false,
      },
      include: {
        estoques: true,
        ProdutoMercadoLivre: {
          select: {
            mlItemId: true,
            mlAvailableQuantity: true,
            mlSold90Days: true,
            mlShippingMode: true,
          },
        },
      },
    });

    if (produtos.length === 0) {
      return NextResponse.json({
        success: true,
        results: [],
        summary: {
          total: 0,
          critico: 0,
          atencao: 0,
          ok: 0,
          custoTotalCritico: 0,
          custoTotalAtencao: 0,
          custoTotalGeral: 0,
        },
      });
    }

    // 2. Buscar conta ML ativa
    const mlAccount = await prisma.mercadoLivreAccount.findFirst({
      where: {
        userId: user.id,
        isActive: true,
      },
    });

    let accessToken: string | null = null;
    if (mlAccount) {
      accessToken = await MercadoLivreService.getValidToken(mlAccount.id);
    }

    // 3. Processar cada produto
    const results: BatchAnalysisResult[] = [];
    const summary = {
      total: 0,
      critico: 0,
      atencao: 0,
      ok: 0,
      custoTotalCritico: 0,
      custoTotalAtencao: 0,
      custoTotalGeral: 0,
    };

    for (const produto of produtos) {
      try {
        // Buscar configuração (ou usar padrão)
        const config = await prisma.stockReplenishmentConfig.findFirst({
          where: {
            userId: user.id,
            produtoId: produto.id,
          },
        });

        const params_config = {
          avgDeliveryDays: config?.avgDeliveryDays || 7,
          fullReleaseDays: config?.fullReleaseDays || 3,
          safetyStock: config?.safetyStock || 10,
          minCoverageDays: config?.minCoverageDays || 30,
          analysisPeriodDays: config?.analysisPeriodDays || 90,
        };

        // Calcular estoques
        const estoqueLocal = produto.estoques.reduce(
          (sum, est) => sum + est.quantidade,
          0
        );

        let estoqueFull = 0;

        // Buscar estoque Full em tempo real
        if (mlAccount && accessToken) {
          const produtosML = await prisma.produtoMercadoLivre.findMany({
            where: {
              produtoId: produto.id,
              mercadoLivreAccountId: mlAccount.id,
            },
          });

          for (const produtoML of produtosML) {
            try {
              const item = await MercadoLivreService.getItem(
                produtoML.mlItemId,
                accessToken
              );

              if (item.shipping?.logistic_type === "fulfillment") {
                estoqueFull += item.available_quantity;
              }
            } catch (error) {
              console.error(
                `[BATCH_ANALYSIS] Erro ao buscar item ${produtoML.mlItemId}:`,
                error
              );
            }
          }
        }

        const estoqueTotal = estoqueLocal + estoqueFull;

        // Calcular vendas do período
        const totalVendas90d = produto.ProdutoMercadoLivre.reduce(
          (sum, pm) => sum + (pm.mlSold90Days || 0),
          0
        );

        const totalVendasPeriodo = Math.round(
          (totalVendas90d / 90) * params_config.analysisPeriodDays
        );

        // Determinar tipo de anúncio
        let tipoAnuncio: "full" | "local" | "ambos" = "local";
        if (estoqueFull > 0 && estoqueLocal > 0) {
          tipoAnuncio = "ambos";
        } else if (estoqueFull > 0) {
          tipoAnuncio = "full";
        }

        // Calcular média diária
        const mediaDiaria =
          totalVendasPeriodo / params_config.analysisPeriodDays;

        // Helper: status baseado em dias restantes
        const calcularStatus = (
          diasRestantes: number,
          diasLimite: number
        ): "ok" | "atencao" | "critico" => {
          if (diasRestantes <= diasLimite * 0.3) return "critico";
          if (diasRestantes <= diasLimite * 0.6) return "atencao";
          return "ok";
        };

        // Reposição Full
        const reposicaoFull =
          tipoAnuncio !== "local"
            ? (() => {
                const pontoReposicaoFull = Math.ceil(
                  mediaDiaria * params_config.fullReleaseDays +
                    params_config.safetyStock * 0.5
                );

                const diasRestantesFull =
                  mediaDiaria > 0 ? Math.floor(estoqueFull / mediaDiaria) : 999;
                const quantidadeSugerida = Math.max(
                  0,
                  pontoReposicaoFull - estoqueFull
                );
                const status = calcularStatus(
                  diasRestantesFull,
                  params_config.fullReleaseDays
                );
                const custoTotal =
                  (quantidadeSugerida * (produto.custoMedio || 0)) / 100;

                return {
                  necessaria: quantidadeSugerida > 0,
                  quantidadeSugerida,
                  diasRestantes: diasRestantesFull,
                  status,
                  custoTotal,
                };
              })()
            : null;

        // Reposição Local
        let diasPrevisao = params_config.avgDeliveryDays;
        if (tipoAnuncio === "full") {
          diasPrevisao =
            params_config.avgDeliveryDays + params_config.fullReleaseDays;
        }

        const estoqueMinimo = Math.max(
          mediaDiaria * diasPrevisao + params_config.safetyStock,
          mediaDiaria * params_config.minCoverageDays
        );

        const pontoReposicaoLocal = Math.ceil(estoqueMinimo);
        const diasRestantesLocal =
          mediaDiaria > 0 ? Math.floor(estoqueLocal / mediaDiaria) : 999;
        let quantidadeSugeridaLocal = Math.max(
          0,
          pontoReposicaoLocal - estoqueLocal
        );

        if (
          tipoAnuncio === "ambos" &&
          reposicaoFull &&
          !reposicaoFull.necessaria &&
          estoqueLocal < reposicaoFull.quantidadeSugerida
        ) {
          quantidadeSugeridaLocal = Math.max(
            quantidadeSugeridaLocal,
            reposicaoFull.quantidadeSugerida - estoqueLocal
          );
        }

        const statusLocal = calcularStatus(diasRestantesLocal, diasPrevisao);
        const custoTotalLocal =
          (quantidadeSugeridaLocal * (produto.custoMedio || 0)) / 100;

        const reposicaoLocal = {
          necessaria: quantidadeSugeridaLocal > 0,
          quantidadeSugerida: quantidadeSugeridaLocal,
          diasRestantes: diasRestantesLocal,
          status: statusLocal,
          custoTotal: custoTotalLocal,
        };

        // Status geral
        let statusGeral: "ok" | "atencao" | "critico" = reposicaoLocal.status;
        if (reposicaoFull && reposicaoFull.status === "critico") {
          statusGeral = "critico";
        } else if (
          reposicaoFull &&
          reposicaoFull.status === "atencao" &&
          statusGeral === "ok"
        ) {
          statusGeral = "atencao";
        }

        const custoTotalReposicao =
          (reposicaoFull?.custoTotal || 0) + custoTotalLocal;

        // Adicionar apenas se precisar de reposição (crítico ou atenção)
        if (statusGeral === "critico" || statusGeral === "atencao") {
          results.push({
            produtoId: produto.id,
            produtoNome: produto.nome,
            sku: produto.sku,
            custoMedio: produto.custoMedio || 0,
            tipoAnuncio,
            estoqueLocal,
            estoqueFull,
            estoqueTotal,
            mediaVendasPeriodo: totalVendasPeriodo,
            mediaDiaria: parseFloat(mediaDiaria.toFixed(2)),
            analysisPeriodDays: params_config.analysisPeriodDays,
            statusGeral,
            reposicaoFull,
            reposicaoLocal,
            custoTotalReposicao,
          });

          summary.total++;
          if (statusGeral === "critico") {
            summary.critico++;
            summary.custoTotalCritico += custoTotalReposicao;
          } else if (statusGeral === "atencao") {
            summary.atencao++;
            summary.custoTotalAtencao += custoTotalReposicao;
          }
          summary.custoTotalGeral += custoTotalReposicao;
        }
      } catch (productError) {
        console.error(
          `[BATCH_ANALYSIS] Erro ao processar produto ${produto.sku}:`,
          productError
        );
      }
    }

    // Ordenar: crítico > atenção > dias restantes (menor primeiro)
    results.sort((a, b) => {
      const prioridadeOrdem = { critico: 1, atencao: 2, ok: 3 };
      if (a.statusGeral !== b.statusGeral) {
        return prioridadeOrdem[a.statusGeral] - prioridadeOrdem[b.statusGeral];
      }
      // Mesmo status: ordenar por dias restantes (menor primeiro)
      const diasA = Math.min(
        a.reposicaoLocal.diasRestantes,
        a.reposicaoFull?.diasRestantes || 999
      );
      const diasB = Math.min(
        b.reposicaoLocal.diasRestantes,
        b.reposicaoFull?.diasRestantes || 999
      );
      return diasA - diasB;
    });

    console.log(
      `[BATCH_ANALYSIS] Análise concluída: ${summary.total} produtos precisam de reposição`
    );
    console.log(
      `[BATCH_ANALYSIS] Crítico: ${summary.critico} | Atenção: ${summary.atencao}`
    );
    console.log(
      `[BATCH_ANALYSIS] Custo total: R$ ${summary.custoTotalGeral.toFixed(2)}`
    );

    return NextResponse.json({
      success: true,
      results,
      summary,
    });
  } catch (error) {
    console.error("[BATCH_ANALYSIS] Erro na análise em lote:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao analisar produtos",
      },
      { status: 500 }
    );
  }
}
