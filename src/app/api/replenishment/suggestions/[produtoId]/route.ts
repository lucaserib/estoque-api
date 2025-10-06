import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { MercadoLivreService } from "@/services/mercadoLivreService";

/**
 * Sugestão inteligente de reposição
 * Separa a lógica de reposição Full (transferência) e Local (compra)
 */
interface ReplenishmentSuggestion {
  // Tipo de produto
  tipoAnuncio: "full" | "local" | "ambos";

  // Estoques atuais
  estoqueLocal: number;
  estoqueFull: number;
  estoqueTotal: number;

  // Vendas e consumo
  mediaVendas90d: number;
  mediaDiaria: number;

  // Sugestão para REPOSIÇÃO FULL (transferir do local → Full)
  // Tempo: fullReleaseDays (ex: 3 dias após coleta)
  reposicaoFull: {
    necessaria: boolean;
    pontoReposicao: number; // Ponto ideal para manter no Full
    diasRestantes: number; // Dias até acabar o Full
    quantidadeSugerida: number; // Quanto transferir do local para Full
    temEstoqueLocal: boolean; // Se tem estoque local suficiente para transferir
    status: "ok" | "atencao" | "critico";
    mensagem: string;
    acaoRecomendada: "transferir" | "aguardar_compra" | "nenhuma"; // Ação sugerida
  } | null;

  // Sugestão para REPOSIÇÃO LOCAL (comprar do fornecedor → Local)
  // Tempo: avgDeliveryDays (ex: 7 dias)
  reposicaoLocal: {
    necessaria: boolean;
    pontoReposicao: number; // Ponto ideal para manter no Local
    diasRestantes: number; // Dias até acabar o local
    quantidadeSugerida: number; // Quanto comprar do fornecedor
    quantidadeParaFull: number; // Quanto dessa compra será para abastecer Full
    quantidadeParaLocal: number; // Quanto ficará no local
    status: "ok" | "atencao" | "critico";
    mensagem: string;
    acaoRecomendada: "comprar" | "nenhuma"; // Ação sugerida
  };

  // Ações prioritárias (ordem de execução)
  acoesPrioritarias: Array<{
    tipo: "transferir_full" | "comprar_local";
    quantidade: number;
    origem: string;
    destino: string;
    prazo: string;
    prioridade: "alta" | "media" | "baixa";
  }>;

  // Status geral (pior entre Full e Local)
  statusGeral: "ok" | "atencao" | "critico";
}

/**
 * GET /api/replenishment/suggestions/[produtoId]
 * Retorna sugestão de reposição para um produto específico
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ produtoId: string }> }
) {
  try {
    const user = await verifyUser(request);
    const { produtoId } = await params;

    // 1. Buscar produto com estoques
    const produto = await prisma.produto.findFirst({
      where: {
        id: produtoId,
        userId: user.id,
      },
      include: {
        estoques: true,
        ProdutoMercadoLivre: {
          select: {
            mlItemId: true,
            mlAvailableQuantity: true,
            mlSoldQuantity: true,
            mlSold90Days: true, // Vendas dos últimos 90 dias (calculado)
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

    // 2. Buscar configuração do produto (ou usar padrão)
    const config = await prisma.stockReplenishmentConfig.findFirst({
      where: {
        userId: user.id,
        produtoId: produtoId,
      },
    });

    const params_config = {
      avgDeliveryDays: config?.avgDeliveryDays || 7,
      fullReleaseDays: config?.fullReleaseDays || 3,
      safetyStock: config?.safetyStock || 10,
      minCoverageDays: config?.minCoverageDays || 30, // Dias mínimos de cobertura
    };

    // 3. Buscar conta ativa do Mercado Livre
    const mlAccount = await prisma.mercadoLivreAccount.findFirst({
      where: {
        userId: user.id,
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

    // 4. Calcular estoques
    const estoqueLocal = produto.estoques.reduce(
      (sum, est) => sum + est.quantidade,
      0
    );
    let estoqueFull = 0;

    // 5. Buscar estoque Full em tempo real
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

    // 6. Buscar vendas dos últimos 90 dias do cache/banco
    // IMPORTANTE: Usamos os dados já calculados pelo endpoint /api/produtos/vendas-ml
    // que é chamado quando o usuário clica em "Atualizar Dados"
    let totalVendas90d = 0;

    // Verificar se há dados de vendas armazenados no próprio produto
    // Buscamos mlSold90Days que foi previamente calculado pelo endpoint /api/produtos/vendas-ml
    const produtosML = await prisma.produtoMercadoLivre.findMany({
      where: {
        produtoId: produto.id,
        mercadoLivreAccountId: mlAccount?.id,
      },
      select: {
        mlItemId: true,
        mlSoldQuantity: true,   // Total histórico (só para debug)
        mlSold90Days: true,     // Vendas dos últimos 90 dias (USADO!)
      },
    });

    // Se temos mlSold90Days no banco, usar isso
    // Caso contrário, retornar 0 (usuário precisa clicar em "Atualizar Dados")
    if (produtosML.length > 0) {
      console.log(`[REPLENISHMENT] Produtos ML vinculados: ${produtosML.length}`);

      produtosML.forEach((pm, idx) => {
        console.log(`[REPLENISHMENT] Produto ML ${idx + 1}:`, {
          mlItemId: pm.mlItemId,
          mlSoldQuantity: pm.mlSoldQuantity, // Total histórico (NÃO usar!)
          mlSold90Days: pm.mlSold90Days,     // Vendas 90 dias (CORRETO!)
        });
      });

      totalVendas90d = produtosML.reduce((sum, pm) => sum + (pm.mlSold90Days || 0), 0);

      console.log(`[REPLENISHMENT] Total vendas 90 dias calculado: ${totalVendas90d}`);
    }

    // NOTA: Se totalVendas90d for 0, significa que os dados ainda não foram atualizados
    // O usuário deve clicar no botão "Atualizar Dados" na página principal
    // Isso evita fazer 20+ requisições ao ML toda vez que abre o modal

    // 7. Determinar tipo de anúncio (Full, Local ou Ambos)
    let tipoAnuncio: "full" | "local" | "ambos" = "local";
    if (estoqueFull > 0 && estoqueLocal > 0) {
      tipoAnuncio = "ambos";
    } else if (estoqueFull > 0) {
      tipoAnuncio = "full";
    }

    // 8. Calcular média diária de vendas
    const mediaDiaria = totalVendas90d / 90;

    // ========================================
    // NOVA LÓGICA INTELIGENTE DE REPOSIÇÃO
    // ========================================

    /**
     * HELPER: Calcula status baseado em dias restantes
     */
    const calcularStatus = (diasRestantes: number, diasLimite: number): "ok" | "atencao" | "critico" => {
      if (diasRestantes <= diasLimite * 0.3) return "critico";
      if (diasRestantes <= diasLimite * 0.6) return "atencao";
      return "ok";
    };

    /**
     * REPOSIÇÃO FULL (Transferir do Local → Full)
     * - Tempo: fullReleaseDays (ex: 3 dias após confirmada a coleta)
     * - Lógica: Manter Full sempre abastecido para vendas rápidas
     */
    const reposicaoFull = tipoAnuncio !== "local" ? (() => {
      // Ponto de reposição Full: consumo durante liberação + segurança
      const pontoReposicaoFull = Math.ceil(
        (mediaDiaria * params_config.fullReleaseDays) + (params_config.safetyStock * 0.5) // 50% da segurança no Full
      );

      const diasRestantesFull = mediaDiaria > 0 ? Math.floor(estoqueFull / mediaDiaria) : 999;
      const quantidadeSugerida = Math.max(0, pontoReposicaoFull - estoqueFull);
      const temEstoqueLocal = estoqueLocal >= quantidadeSugerida;

      const status = calcularStatus(diasRestantesFull, params_config.fullReleaseDays);

      // Determinar ação recomendada
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

    /**
     * REPOSIÇÃO LOCAL (Comprar do Fornecedor → Local)
     * - Tempo: avgDeliveryDays (ex: 7 dias)
     * - Lógica: Manter estoque local suficiente para abastecer Full + vendas locais
     */
    const reposicaoLocal = (() => {
      // Para produtos "ambos": considerar que local precisa abastecer Full também
      // Para produtos "local": considerar apenas vendas locais
      // Para produtos "full": considerar o tempo total (entrega + liberação Full)

      let diasPrevisao = params_config.avgDeliveryDays;

      if (tipoAnuncio === "full") {
        // Full-only: tempo total = entrega + liberação
        diasPrevisao = params_config.avgDeliveryDays + params_config.fullReleaseDays;
      } else if (tipoAnuncio === "ambos") {
        // Ambos: local precisa aguentar o período de entrega
        diasPrevisao = params_config.avgDeliveryDays;
      }

      // Ponto de reposição local considera:
      // 1. Consumo durante o prazo de entrega
      // 2. Estoque de segurança em unidades
      // 3. Cobertura mínima em dias (ex: manter sempre 30 dias de vendas)
      const estoqueMinimo = Math.max(
        (mediaDiaria * diasPrevisao) + params_config.safetyStock,
        mediaDiaria * params_config.minCoverageDays // Garante cobertura mínima
      );

      const pontoReposicaoLocal = Math.ceil(estoqueMinimo);

      const diasRestantesLocal = mediaDiaria > 0 ? Math.floor(estoqueLocal / mediaDiaria) : 999;

      // Quantidade a comprar considera o que já está no local
      let quantidadeSugerida = Math.max(0, pontoReposicaoLocal - estoqueLocal);

      // Se tem produto "ambos" e Full está baixo, pode precisar comprar extra para repor Full
      if (tipoAnuncio === "ambos" && reposicaoFull && !reposicaoFull.temEstoqueLocal) {
        quantidadeSugerida = Math.max(quantidadeSugerida, reposicaoFull.quantidadeSugerida - estoqueLocal);
      }

      const status = calcularStatus(diasRestantesLocal, diasPrevisao);

      // Calcular quanto da compra vai para Full e quanto fica no Local
      const quantidadeParaFull = reposicaoFull && reposicaoFull.necessaria && !reposicaoFull.temEstoqueLocal
        ? Math.min(reposicaoFull.quantidadeSugerida, quantidadeSugerida)
        : 0;
      const quantidadeParaLocal = quantidadeSugerida - quantidadeParaFull;

      // Determinar ação recomendada e mensagem
      let acaoRecomendada: "comprar" | "nenhuma" = "nenhuma";
      let mensagem = "";

      if (quantidadeSugerida === 0) {
        mensagem = `Estoque Local adequado (${diasRestantesLocal} dias de cobertura)`;
        acaoRecomendada = "nenhuma";
      } else {
        // Mensagem detalhada sobre o uso da compra
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

    // Status geral: pior status entre Full e Local
    let statusGeral: "ok" | "atencao" | "critico" = reposicaoLocal.status;
    if (reposicaoFull && reposicaoFull.status === "critico") {
      statusGeral = "critico";
    } else if (reposicaoFull && reposicaoFull.status === "atencao" && statusGeral === "ok") {
      statusGeral = "atencao";
    }

    // ========================================
    // AÇÕES PRIORITÁRIAS (ordem de execução)
    // ========================================
    const acoesPrioritarias: Array<{
      tipo: "transferir_full" | "comprar_local";
      quantidade: number;
      origem: string;
      destino: string;
      prazo: string;
      prioridade: "alta" | "media" | "baixa";
    }> = [];

    // 1. TRANSFERÊNCIA FULL (mais rápida, prioridade se possível)
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

    // 2. COMPRA LOCAL (mais demorada, mas necessária)
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

    // Ordenar por prioridade (alta → media → baixa)
    acoesPrioritarias.sort((a, b) => {
      const prioridadeOrdem = { alta: 1, media: 2, baixa: 3 };
      return prioridadeOrdem[a.prioridade] - prioridadeOrdem[b.prioridade];
    });

    const suggestion: ReplenishmentSuggestion = {
      tipoAnuncio,
      estoqueLocal,
      estoqueFull,
      estoqueTotal,
      mediaVendas90d: totalVendas90d,
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
