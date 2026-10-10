import { prisma } from "@/lib/prisma";
import { MercadoLivreService } from "@/services/mercadoLivreService";
import { fetchOrdersWithFallback } from "@/lib/mlOrders";

export interface ConfigReposicao {
  avgDeliveryDays: number;
  fullReleaseDays: number;
  safetyStock: number;
  minCoverageDays: number;
}

export interface FornecedorPrincipalInfo {
  fornecedorId: string;
  fornecedorNome: string;
  prazoEntregaDias: number | null;
  quantidadeMinima: number | null;
  multiplicador: number;
}

export interface DadosProdutoReposicao {
  produtoId: string;
  nome: string;
  sku: string;
  custoMedio: number | null;
  vendas30Dias: number;
  vendas31a90Dias: number;
  estoqueLocal: number;
  estoqueFullDisponivel: number;
  estoqueFullEmTransito: number;
  pedidosEmAbertoUnidades: number;
  temAnuncioFull: boolean;
  fornecedorPrincipal: FornecedorPrincipalInfo | null;
  config: ConfigReposicao;
}

export interface SugestaoReposicao {
  produtoId: string;
  nome: string;
  sku: string;
  custoMedio: number | null;
  estoqueLocal: number;
  estoqueFullDisponivel: number;
  estoqueFullEmTransito: number;
  pedidosEmAbertoUnidades: number;
  temAnuncioFull: boolean;
  demandaDiaria: number;
  leadTimeDias: number;
  estoqueDisponivel: number;
  pontoPedido: number;
  coberturaDias: number | null;
  quantidadeSugeridaCompraUnidades: number;
  quantidadeSugeridaCompraCaixas: number;
  quantidadeSugeridaEnvioFull: number;
  custoTotalCompra: number | null;
  custoIndefinido: boolean;
  fornecedorPrincipalId: string | null;
  fornecedorPrincipalNome: string | null;
  status: "ok" | "atencao" | "critico";
}

/**
 * Cálculo puro, sem acesso a banco/API — recebe os dados já agregados pelo
 * chamador (calcularReposicaoConta) e devolve a sugestão para um produto.
 */
export function calcularSugestaoReposicao(
  dados: DadosProdutoReposicao
): SugestaoReposicao {
  // Média ponderada: últimos 30 dias pesam mais que o intervalo 31-90.
  const demandaDiaria =
    (dados.vendas30Dias / 30) * 0.7 + (dados.vendas31a90Dias / 60) * 0.3;

  const leadTimeBase =
    dados.fornecedorPrincipal?.prazoEntregaDias ?? dados.config.avgDeliveryDays;
  const leadTimeDias =
    leadTimeBase + (dados.temAnuncioFull ? dados.config.fullReleaseDays : 0);

  const estoqueDisponivel =
    dados.estoqueLocal +
    dados.estoqueFullDisponivel +
    dados.estoqueFullEmTransito +
    dados.pedidosEmAbertoUnidades;

  const pontoPedido = demandaDiaria * leadTimeDias + dados.config.safetyStock;
  const coberturaAlvo =
    demandaDiaria * dados.config.minCoverageDays + dados.config.safetyStock;
  const coberturaDias =
    demandaDiaria > 0 ? estoqueDisponivel / demandaDiaria : null;

  let quantidadeSugeridaCompraUnidades = 0;
  if (estoqueDisponivel <= pontoPedido) {
    quantidadeSugeridaCompraUnidades = Math.max(
      0,
      Math.ceil(coberturaAlvo - estoqueDisponivel)
    );

    const fornecedor = dados.fornecedorPrincipal;
    if (fornecedor) {
      if (fornecedor.quantidadeMinima) {
        quantidadeSugeridaCompraUnidades = Math.max(
          quantidadeSugeridaCompraUnidades,
          fornecedor.quantidadeMinima
        );
      }
      if (fornecedor.multiplicador > 1 && quantidadeSugeridaCompraUnidades > 0) {
        quantidadeSugeridaCompraUnidades =
          Math.ceil(quantidadeSugeridaCompraUnidades / fornecedor.multiplicador) *
          fornecedor.multiplicador;
      }
    }
  }

  // Envio ao Full: o Full precisa de estoque para cobrir seu próprio prazo
  // de reposição (fullReleaseDays); se estiver curto e o local tiver
  // sobra além do próprio estoque de segurança, sugere mover a diferença
  // (limitada pela sobra local disponível).
  let quantidadeSugeridaEnvioFull = 0;
  if (dados.temAnuncioFull) {
    const necessarioNoFull = demandaDiaria * dados.config.fullReleaseDays;
    const faltaNoFull = Math.max(
      0,
      Math.ceil(
        necessarioNoFull -
          (dados.estoqueFullDisponivel + dados.estoqueFullEmTransito)
      )
    );
    const sobraLocal = Math.max(
      0,
      dados.estoqueLocal - dados.config.safetyStock
    );
    quantidadeSugeridaEnvioFull = Math.min(faltaNoFull, sobraLocal);
  }

  const custoIndefinido = dados.custoMedio == null;
  const custoTotalCompra = custoIndefinido
    ? null
    : quantidadeSugeridaCompraUnidades * (dados.custoMedio as number);

  const multiplicadorFinal = dados.fornecedorPrincipal?.multiplicador ?? 1;
  const quantidadeSugeridaCompraCaixas =
    multiplicadorFinal > 0
      ? Math.round(quantidadeSugeridaCompraUnidades / multiplicadorFinal)
      : quantidadeSugeridaCompraUnidades;

  let status: SugestaoReposicao["status"] = "ok";
  if (estoqueDisponivel <= 0) {
    status = "critico";
  } else if (estoqueDisponivel <= pontoPedido) {
    status = "atencao";
  }

  return {
    produtoId: dados.produtoId,
    nome: dados.nome,
    sku: dados.sku,
    custoMedio: dados.custoMedio,
    estoqueLocal: dados.estoqueLocal,
    estoqueFullDisponivel: dados.estoqueFullDisponivel,
    estoqueFullEmTransito: dados.estoqueFullEmTransito,
    pedidosEmAbertoUnidades: dados.pedidosEmAbertoUnidades,
    temAnuncioFull: dados.temAnuncioFull,
    demandaDiaria,
    leadTimeDias,
    estoqueDisponivel,
    pontoPedido,
    coberturaDias,
    quantidadeSugeridaCompraUnidades,
    quantidadeSugeridaCompraCaixas,
    quantidadeSugeridaEnvioFull,
    custoTotalCompra,
    custoIndefinido,
    fornecedorPrincipalId: dados.fornecedorPrincipal?.fornecedorId ?? null,
    fornecedorPrincipalNome: dados.fornecedorPrincipal?.fornecedorNome ?? null,
    status,
  };
}

export interface VendasPorProduto {
  v30: number;
  v90: number;
}

/**
 * Soma a demanda de cada kit vendido na demanda dos seus componentes
 * (Componente.quantidade por unidade de kit). A entrada do próprio kit
 * permanece no mapa (produto pré-montado também pode ter estoque próprio).
 */
export function explodirDemandaKits(
  vendasPorProduto: Map<string, VendasPorProduto>,
  componentesPorKit: Map<string, Array<{ produtoId: string; quantidade: number }>>
): Map<string, VendasPorProduto> {
  const resultado = new Map<string, VendasPorProduto>();
  for (const [produtoId, vendas] of vendasPorProduto) {
    resultado.set(produtoId, { ...vendas });
  }

  for (const [kitId, vendasKit] of vendasPorProduto) {
    const componentes = componentesPorKit.get(kitId);
    if (!componentes) continue;

    for (const componente of componentes) {
      const atual = resultado.get(componente.produtoId) ?? { v30: 0, v90: 0 };
      resultado.set(componente.produtoId, {
        v30: atual.v30 + vendasKit.v30 * componente.quantidade,
        v90: atual.v90 + vendasKit.v90 * componente.quantidade,
      });
    }
  }

  return resultado;
}

const NOVENTA_DIAS_MS = 90 * 24 * 60 * 60 * 1000;
const TRINTA_DIAS_MS = 30 * 24 * 60 * 60 * 1000;
const STATUS_VENDA_VALIDOS = [
  "paid",
  "delivered",
  "ready_to_ship",
  "shipped",
  "handling",
];

export interface ReposicaoContaResultado {
  sugestoes: SugestaoReposicao[];
  parcial: boolean;
}

/**
 * Monta os dados de cada produto (vendas ML + saídas manuais explodidas por
 * kit, estoque local, snapshot do Full da Fase 5, pedidos de compra em
 * aberto, config por produto com fallback global) e aplica
 * calcularSugestaoReposicao. Uma única chamada ao ML por conta (pedidos do
 * período) — nunca uma chamada por produto.
 */
export async function calcularReposicaoConta(
  userId: string
): Promise<ReposicaoContaResultado> {
  const agora = new Date();
  const haNoventaDias = new Date(agora.getTime() - NOVENTA_DIAS_MS);
  const haTrintaDias = new Date(agora.getTime() - TRINTA_DIAS_MS);

  const [produtos, configs, mlAccount, pedidosAbertos, configGeral, saidas] =
    await Promise.all([
      prisma.produto.findMany({
        where: { userId, ativo: true },
        select: {
          id: true,
          nome: true,
          sku: true,
          custoMedio: true,
          isKit: true,
          estoques: {
            where: { armazem: { tipo: "LOCAL" } },
            select: { quantidade: true },
          },
          fornecedores: {
            where: { principal: true },
            select: {
              fornecedorId: true,
              prazoEntregaDias: true,
              quantidadeMinima: true,
              multiplicador: true,
              fornecedor: { select: { nome: true } },
            },
          },
          ProdutoMercadoLivre: {
            select: {
              mlItemId: true,
              mlStatus: true,
              mlLogisticType: true,
              mlFullDisponivel: true,
              mlFullEmTransito: true,
            },
          },
          componentes: { select: { produtoId: true, quantidade: true } },
        },
      }),
      prisma.stockReplenishmentConfig.findMany({ where: { userId } }),
      prisma.mercadoLivreAccount.findFirst({
        where: { userId, isActive: true },
      }),
      prisma.pedidoProduto.findMany({
        where: { pedido: { userId, status: "pendente" } },
        select: { produtoId: true, quantidade: true, multiplicador: true },
      }),
      prisma.configuracaoGeral.findUnique({ where: { userId } }),
      prisma.detalhesSaida.findMany({
        where: { saida: { userId, data: { gte: haNoventaDias } } },
        select: {
          produtoId: true,
          quantidade: true,
          saida: { select: { data: true } },
        },
      }),
    ]);

  const configPorProduto = new Map(configs.map((c) => [c.produtoId, c]));

  const pedidosAbertosPorProduto = new Map<string, number>();
  for (const pp of pedidosAbertos) {
    pedidosAbertosPorProduto.set(
      pp.produtoId,
      (pedidosAbertosPorProduto.get(pp.produtoId) ?? 0) +
        pp.quantidade * pp.multiplicador
    );
  }

  const vendasPorMlItem = new Map<string, VendasPorProduto>();
  let parcial = false;

  if (mlAccount) {
    try {
      const accessToken = await MercadoLivreService.getValidToken(mlAccount.id);
      const { orders, parcial: pedidosParcial } = await fetchOrdersWithFallback({
        accessToken,
        sellerId: mlAccount.mlUserId,
        dateFrom: haNoventaDias,
        dateTo: agora,
      });
      parcial = pedidosParcial;

      for (const order of orders) {
        if (!STATUS_VENDA_VALIDOS.includes(order.status)) continue;
        const dataPedido = new Date(order.date_created);
        const recente = dataPedido >= haTrintaDias;

        for (const item of order.order_items) {
          const atual = vendasPorMlItem.get(item.item.id) ?? { v30: 0, v90: 0 };
          if (recente) atual.v30 += item.quantity;
          else atual.v90 += item.quantity;
          vendasPorMlItem.set(item.item.id, atual);
        }
      }
    } catch (error) {
      console.error("[REPOSICAO] Erro ao buscar pedidos do ML:", error);
      parcial = true;
    }
  }

  const vendasPorProduto = new Map<string, VendasPorProduto>();

  for (const produto of produtos) {
    for (const pml of produto.ProdutoMercadoLivre) {
      const vendasItem = vendasPorMlItem.get(pml.mlItemId);
      if (!vendasItem) continue;
      const atual = vendasPorProduto.get(produto.id) ?? { v30: 0, v90: 0 };
      vendasPorProduto.set(produto.id, {
        v30: atual.v30 + vendasItem.v30,
        v90: atual.v90 + vendasItem.v90,
      });
    }
  }

  for (const detalhe of saidas) {
    const recente = detalhe.saida.data >= haTrintaDias;
    const atual = vendasPorProduto.get(detalhe.produtoId) ?? { v30: 0, v90: 0 };
    if (recente) atual.v30 += detalhe.quantidade;
    else atual.v90 += detalhe.quantidade;
    vendasPorProduto.set(detalhe.produtoId, atual);
  }

  const componentesPorKit = new Map(
    produtos
      .filter((p) => p.isKit)
      .map((p) => [
        p.id,
        p.componentes.map((c) => ({
          produtoId: c.produtoId,
          quantidade: c.quantidade,
        })),
      ])
  );

  const demandaExplodida = explodirDemandaKits(
    vendasPorProduto,
    componentesPorKit
  );

  const sugestoes = produtos.map((produto) => {
    const vendas = demandaExplodida.get(produto.id) ?? { v30: 0, v90: 0 };
    const config = configPorProduto.get(produto.id);
    const estoqueLocal = produto.estoques.reduce(
      (sum, e) => sum + e.quantidade,
      0
    );
    const anuncioFull = produto.ProdutoMercadoLivre.find(
      (p) => p.mlLogisticType === "fulfillment" && p.mlStatus === "active"
    );
    const fornecedorPrincipal = produto.fornecedores[0];

    return calcularSugestaoReposicao({
      produtoId: produto.id,
      nome: produto.nome,
      sku: produto.sku,
      custoMedio: produto.custoMedio,
      vendas30Dias: vendas.v30,
      vendas31a90Dias: vendas.v90,
      estoqueLocal,
      estoqueFullDisponivel: anuncioFull?.mlFullDisponivel ?? 0,
      estoqueFullEmTransito: anuncioFull?.mlFullEmTransito ?? 0,
      pedidosEmAbertoUnidades: pedidosAbertosPorProduto.get(produto.id) ?? 0,
      temAnuncioFull: !!anuncioFull,
      fornecedorPrincipal: fornecedorPrincipal
        ? {
            fornecedorId: fornecedorPrincipal.fornecedorId,
            fornecedorNome: fornecedorPrincipal.fornecedor.nome,
            prazoEntregaDias: fornecedorPrincipal.prazoEntregaDias,
            quantidadeMinima: fornecedorPrincipal.quantidadeMinima,
            multiplicador: fornecedorPrincipal.multiplicador,
          }
        : null,
      config: {
        avgDeliveryDays:
          config?.avgDeliveryDays ?? configGeral?.avgDeliveryDaysPadrao ?? 7,
        fullReleaseDays: config?.fullReleaseDays ?? 3,
        safetyStock: config?.safetyStock ?? 10,
        minCoverageDays: config?.minCoverageDays ?? 30,
      },
    });
  });

  return { sugestoes, parcial };
}
