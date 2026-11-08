import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { MercadoLivreService } from "@/services/mercadoLivreService";

interface ReplenishmentSuggestion {
  tipoAnuncio: "full" | "local" | "ambos";

  estoqueLocal: number;
  estoqueFull: number;
  estoqueTotal: number;

  mediaVendas90d: number;
  mediaDiaria: number;

  reposicaoFull: {
    necessaria: boolean;
    pontoReposicao: number;
    diasRestantes: number;
    quantidadeSugerida: number;
    temEstoqueLocal: boolean;
    status: "ok" | "atencao" | "critico";
    mensagem: string;
    acaoRecomendada: "transferir" | "aguardar_compra" | "nenhuma";
  } | null;

  reposicaoLocal: {
    necessaria: boolean;
    pontoReposicao: number;
    diasRestantes: number;
    quantidadeSugerida: number;
    quantidadeParaFull: number;
    quantidadeParaLocal: number;
    status: "ok" | "atencao" | "critico";
    mensagem: string;
    acaoRecomendada: "comprar" | "nenhuma";
  };

  acoesPrioritarias: Array<{
    tipo: "transferir_full" | "comprar_local";
    quantidade: number;
    origem: string;
    destino: string;
    prazo: string;
    prioridade: "alta" | "media" | "baixa";
  }>;

  statusGeral: "ok" | "atencao" | "critico";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ produtoId: string }> }
) {
  try {
    const user = await verifyUser(request);
    const { produtoId } = await params;

    const produto = await prisma.produto.findFirst({
      where: {
        id: produtoId,
        userId: user.contaId,
      },
      include: {
        estoques: true,
        ProdutoMercadoLivre: {
          select: {
            mlItemId: true,
            mlAvailableQuantity: true,
            mlSoldQuantity: true,
            mlSold90Days: true,
            mlShippingMode: true,
            mlStatus: true,
          },
        },
      },
    });

    if (!produto) {
      return NextResponse.json(
        { error: "Produto não encontrado" },
        { status: 404 }
      );
    }

    const config = await prisma.stockReplenishmentConfig.findFirst({
      where: {
        userId: user.contaId,
        produtoId: produtoId,
      },
    });

    const params_config = {
      avgDeliveryDays: config?.avgDeliveryDays || 7,
      fullReleaseDays: config?.fullReleaseDays || 3,
      safetyStock: config?.safetyStock || 10,
      minCoverageDays: config?.minCoverageDays || 30,
      analysisPeriodDays: config?.analysisPeriodDays || 90,
    };

    const mlAccount = await prisma.mercadoLivreAccount.findFirst({
      where: {
        userId: user.contaId,
        isActive: true,
      },
    });

    let accessToken: string | null = null;
    if (mlAccount) {
      const now = new Date();
      if (mlAccount.expiresAt > now) {
        accessToken = mlAccount.accessToken;
      } else {
        const newTokens = await MercadoLivreService.refreshAccessToken(
          mlAccount.refreshToken
        );
        accessToken = newTokens.access_token;

        await prisma.mercadoLivreAccount.update({
          where: { id: mlAccount.id },
          data: {
            accessToken: newTokens.access_token,
            refreshToken: newTokens.refresh_token,
            expiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
          },
        });
      }
    }

    const estoqueLocal = produto.estoques.reduce(
      (sum, est) => sum + est.quantidade,
      0
    );
    let estoqueFull = 0;

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
            `[REPLENISHMENT] Erro ao buscar item ${produtoML.mlItemId}:`,
            error
          );
        }
      }
    }

    const estoqueTotal = estoqueLocal + estoqueFull;

    let totalVendasPeriodo = 0;

    const produtosML = await prisma.produtoMercadoLivre.findMany({
      where: {
        produtoId: produto.id,
        mercadoLivreAccountId: mlAccount?.id,
      },
      select: {
        mlItemId: true,
        mlSoldQuantity: true,
        mlSold90Days: true,
      },
    });

    if (produtosML.length > 0) {

      const totalVendas90d = produtosML.reduce(
        (sum, pm) => sum + (pm.mlSold90Days || 0),
        0
      );

      totalVendasPeriodo = Math.round(
        (totalVendas90d / 90) * params_config.analysisPeriodDays
      );
    }

    let tipoAnuncio: "full" | "local" | "ambos" = "local";
    if (estoqueFull > 0 && estoqueLocal > 0) {
      tipoAnuncio = "ambos";
    } else if (estoqueFull > 0) {
      tipoAnuncio = "full";
    }

    const mediaDiaria = totalVendasPeriodo / params_config.analysisPeriodDays;

    const calcularStatus = (diasRestantes: number, diasLimite: number): "ok" | "atencao" | "critico" => {
      if (diasRestantes <= diasLimite * 0.3) return "critico";
      if (diasRestantes <= diasLimite * 0.6) return "atencao";
      return "ok";
    };

    const reposicaoFull = tipoAnuncio !== "local" ? (() => {
      const pontoReposicaoFull = Math.ceil(
        (mediaDiaria * params_config.fullReleaseDays) + (params_config.safetyStock * 0.5)
      );

      const diasRestantesFull = mediaDiaria > 0 ? Math.floor(estoqueFull / mediaDiaria) : 999;
      const quantidadeSugerida = Math.max(0, pontoReposicaoFull - estoqueFull);
      const temEstoqueLocal = estoqueLocal >= quantidadeSugerida;

      const status = calcularStatus(diasRestantesFull, params_config.fullReleaseDays);

      let acaoRecomendada: "transferir" | "aguardar_compra" | "nenhuma" = "nenhuma";
      let mensagem = "";

      if (quantidadeSugerida === 0) {
        mensagem = `Estoque Full adequado (${diasRestantesFull} dias de cobertura)`;
        acaoRecomendada = "nenhuma";
      } else if (temEstoqueLocal) {
        mensagem = `Transferir ${quantidadeSugerida} unidades do local → Full`;
        acaoRecomendada = "transferir";
      } else {
        mensagem = `Full precisa de ${quantidadeSugerida} unidades, mas local só tem ${estoqueLocal}. Aguardar compra.`;
        acaoRecomendada = "aguardar_compra";
      }

      return {
        necessaria: quantidadeSugerida > 0,
        pontoReposicao: pontoReposicaoFull,
        diasRestantes: diasRestantesFull,
        quantidadeSugerida,
        temEstoqueLocal,
        status,
        mensagem,
        acaoRecomendada,
      };
    })() : null;

    const reposicaoLocal = (() => {

      let diasPrevisao = params_config.avgDeliveryDays;

      if (tipoAnuncio === "full") {
        diasPrevisao = params_config.avgDeliveryDays + params_config.fullReleaseDays;
      } else if (tipoAnuncio === "ambos") {
        diasPrevisao = params_config.avgDeliveryDays;
      }

      const estoqueMinimo = Math.max(
        (mediaDiaria * diasPrevisao) + params_config.safetyStock,
        mediaDiaria * params_config.minCoverageDays
      );

      const pontoReposicaoLocal = Math.ceil(estoqueMinimo);

      const diasRestantesLocal = mediaDiaria > 0 ? Math.floor(estoqueLocal / mediaDiaria) : 999;

      let quantidadeSugerida = Math.max(0, pontoReposicaoLocal - estoqueLocal);

      if (tipoAnuncio === "ambos" && reposicaoFull && !reposicaoFull.temEstoqueLocal) {
        quantidadeSugerida = Math.max(quantidadeSugerida, reposicaoFull.quantidadeSugerida - estoqueLocal);
      }

      const status = calcularStatus(diasRestantesLocal, diasPrevisao);

      const quantidadeParaFull = reposicaoFull && reposicaoFull.necessaria && !reposicaoFull.temEstoqueLocal
        ? Math.min(reposicaoFull.quantidadeSugerida, quantidadeSugerida)
        : 0;
      const quantidadeParaLocal = quantidadeSugerida - quantidadeParaFull;

      let acaoRecomendada: "comprar" | "nenhuma" = "nenhuma";
      let mensagem = "";

      if (quantidadeSugerida === 0) {
        mensagem = `Estoque Local adequado (${diasRestantesLocal} dias de cobertura)`;
        acaoRecomendada = "nenhuma";
      } else {
        if (quantidadeParaFull > 0 && quantidadeParaLocal > 0) {
          mensagem = `Comprar ${quantidadeSugerida} unidades: ${quantidadeParaFull} para Full + ${quantidadeParaLocal} para Local`;
        } else if (quantidadeParaFull > 0) {
          mensagem = `Comprar ${quantidadeSugerida} unidades para abastecer o Full`;
        } else {
          mensagem = `Comprar ${quantidadeSugerida} unidades para o estoque local`;
        }
        acaoRecomendada = "comprar";
      }

      return {
        necessaria: quantidadeSugerida > 0,
        pontoReposicao: pontoReposicaoLocal,
        diasRestantes: diasRestantesLocal,
        quantidadeSugerida,
        quantidadeParaFull,
        quantidadeParaLocal,
        status,
        mensagem,
        acaoRecomendada,
      };
    })();

    let statusGeral: "ok" | "atencao" | "critico" = reposicaoLocal.status;
    if (reposicaoFull && reposicaoFull.status === "critico") {
      statusGeral = "critico";
    } else if (reposicaoFull && reposicaoFull.status === "atencao" && statusGeral === "ok") {
      statusGeral = "atencao";
    }

    const acoesPrioritarias: Array<{
      tipo: "transferir_full" | "comprar_local";
      quantidade: number;
      origem: string;
      destino: string;
      prazo: string;
      prioridade: "alta" | "media" | "baixa";
    }> = [];

    if (reposicaoFull && reposicaoFull.acaoRecomendada === "transferir") {
      acoesPrioritarias.push({
        tipo: "transferir_full",
        quantidade: reposicaoFull.quantidadeSugerida,
        origem: "Estoque Local",
        destino: "Mercado Envios Full",
        prazo: `~${params_config.fullReleaseDays} dias`,
        prioridade: reposicaoFull.status === "critico" ? "alta" : reposicaoFull.status === "atencao" ? "media" : "baixa",
      });
    }

    if (reposicaoLocal.acaoRecomendada === "comprar") {
      acoesPrioritarias.push({
        tipo: "comprar_local",
        quantidade: reposicaoLocal.quantidadeSugerida,
        origem: "Fornecedor",
        destino: reposicaoLocal.quantidadeParaFull > 0 ? "Estoque Local → Full" : "Estoque Local",
        prazo: `~${params_config.avgDeliveryDays} dias`,
        prioridade: reposicaoLocal.status === "critico" ? "alta" : reposicaoLocal.status === "atencao" ? "media" : "baixa",
      });
    }

    acoesPrioritarias.sort((a, b) => {
      const prioridadeOrdem = { alta: 1, media: 2, baixa: 3 };
      return prioridadeOrdem[a.prioridade] - prioridadeOrdem[b.prioridade];
    });

    const suggestion: ReplenishmentSuggestion = {
      tipoAnuncio,
      estoqueLocal,
      estoqueFull,
      estoqueTotal,
      mediaVendas90d: totalVendasPeriodo,
      mediaDiaria: parseFloat(mediaDiaria.toFixed(2)),
      reposicaoFull,
      reposicaoLocal,
      acoesPrioritarias,
      statusGeral,
    };

    return NextResponse.json({
      success: true,
      suggestion,
      config: params_config,
    });
  } catch (error) {
    console.error("Erro ao calcular sugestão de reposição:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao calcular sugestão",
      },
      { status: 500 }
    );
  }
}
