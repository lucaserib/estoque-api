import { CanalVenda, StatusVendaCanal } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface ConfigReposicao {
  avgDeliveryDays: number;
  fullReleaseDays: number;
  safetyStock: number;
  minCoverageDays: number;
  analysisPeriodDays: number;
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
  vendasPeriodoAnteriorDias: number;
  estoqueLocal: number;
  estoqueFullDisponivel: number;
  estoqueFullEmTransito: number;
  estoqueFullIndisponivel: number;
  pedidosEmAbertoUnidades: number;
  temAnuncioFull: boolean;
  fornecedorPrincipal: FornecedorPrincipalInfo | null;
  config: ConfigReposicao;
  estoqueEmKitsUnidades?: number;
  ehKit?: boolean;
}

export interface SugestaoReposicao {
  produtoId: string;
  nome: string;
  sku: string;
  custoMedio: number | null;
  estoqueLocal: number;
  estoqueFullDisponivel: number;
  estoqueFullEmTransito: number;
  estoqueFullIndisponivel: number;
  pedidosEmAbertoUnidades: number;
  estoqueEmKitsUnidades: number;
  temAnuncioFull: boolean;
  ehKit: boolean;
  demandaDiaria: number;
  leadTimeDias: number;
  estoqueDisponivel: number;
  pontoPedido: number;
  coberturaDias: number | null;
  coberturaDiasLocal: number | null;
  coberturaDiasFull: number | null;
  dataRupturaPrevista: string | null;
  quantidadeSugeridaCompraUnidades: number;
  quantidadeSugeridaCompraCaixas: number;
  quantidadeSugeridaEnvioFull: number;
  custoTotalCompra: number | null;
  custoIndefinido: boolean;
  fornecedorPrincipalId: string | null;
  fornecedorPrincipalNome: string | null;
  status: "ok" | "atencao" | "critico";
}

export function calcularSugestaoReposicao(
  dados: DadosProdutoReposicao
): SugestaoReposicao {
  const diasRestante = dados.config.analysisPeriodDays - 30;
  const demandaDiaria =
    diasRestante <= 0
      ? dados.vendas30Dias / 30
      : (dados.vendas30Dias / 30) * 0.7 + (dados.vendasPeriodoAnteriorDias / diasRestante) * 0.3;

  const leadTimeBase =
    dados.fornecedorPrincipal?.prazoEntregaDias ?? dados.config.avgDeliveryDays;
  const leadTimeDias =
    leadTimeBase + (dados.temAnuncioFull ? dados.config.fullReleaseDays : 0);

  const estoqueEmKitsUnidades = dados.estoqueEmKitsUnidades ?? 0;
  const estoqueDisponivel =
    dados.estoqueLocal +
    dados.estoqueFullDisponivel +
    dados.estoqueFullEmTransito +
    dados.pedidosEmAbertoUnidades +
    estoqueEmKitsUnidades;

  const pontoPedido = demandaDiaria * leadTimeDias + dados.config.safetyStock;
  const coberturaAlvo =
    demandaDiaria * dados.config.minCoverageDays + dados.config.safetyStock;
  const coberturaDias =
    demandaDiaria > 0 ? estoqueDisponivel / demandaDiaria : null;
  const coberturaDiasLocal =
    demandaDiaria > 0 ? dados.estoqueLocal / demandaDiaria : null;
  const coberturaDiasFull =
    demandaDiaria > 0 && dados.temAnuncioFull
      ? (dados.estoqueFullDisponivel + dados.estoqueFullEmTransito) / demandaDiaria
      : null;
  const dataRupturaPrevista =
    coberturaDias != null
      ? new Date(Date.now() + Math.floor(coberturaDias) * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10)
      : null;

  let quantidadeSugeridaCompraUnidades = 0;
  if (!dados.ehKit && estoqueDisponivel <= pontoPedido) {
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
    estoqueFullIndisponivel: dados.estoqueFullIndisponivel,
    pedidosEmAbertoUnidades: dados.pedidosEmAbertoUnidades,
    estoqueEmKitsUnidades,
    temAnuncioFull: dados.temAnuncioFull,
    ehKit: dados.ehKit ?? false,
    demandaDiaria,
    leadTimeDias,
    estoqueDisponivel,
    pontoPedido,
    coberturaDias,
    coberturaDiasLocal,
    coberturaDiasFull,
    dataRupturaPrevista,
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
const STATUS_VENDA_VALIDOS: StatusVendaCanal[] = [
  StatusVendaCanal.PAGA,
  StatusVendaCanal.DEVOLVIDA_PARCIAL,
  StatusVendaCanal.EM_MEDIACAO,
];

function vendasNoPeriodoAnterior(v90: number, analysisPeriodDays: number): number {
  if (analysisPeriodDays <= 30) return 0;
  const diasRestante = analysisPeriodDays - 30;
  return Math.round(v90 * (diasRestante / 60));
}

export interface ReposicaoContaResultado {
  sugestoes: SugestaoReposicao[];
  parcial: boolean;
}

export async function calcularReposicaoConta(
  userId: string
): Promise<ReposicaoContaResultado> {
  const agora = new Date();
  const haNoventaDias = new Date(agora.getTime() - NOVENTA_DIAS_MS);
  const haTrintaDias = new Date(agora.getTime() - TRINTA_DIAS_MS);

  const [produtos, configs, pedidosAbertos, configGeral, saidas, itensVendidos] =
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
              mlFullIndisponivel: true,
            },
          },
          componentes: { select: { produtoId: true, quantidade: true } },
        },
      }),
      prisma.stockReplenishmentConfig.findMany({ where: { userId } }),
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
      prisma.vendaCanalItem.findMany({
        where: {
          produtoId: { not: null },
          venda: {
            userId,
            canal: CanalVenda.MERCADO_LIVRE,
            status: { in: STATUS_VENDA_VALIDOS },
            dataVenda: { gte: haNoventaDias, lte: agora },
          },
        },
        select: {
          produtoId: true,
          quantidade: true,
          venda: { select: { dataVenda: true } },
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

  const vendasPorProduto = new Map<string, VendasPorProduto>();

  for (const item of itensVendidos) {
    const produtoId = item.produtoId as string;
    const recente = item.venda.dataVenda >= haTrintaDias;
    const atual = vendasPorProduto.get(produtoId) ?? { v30: 0, v90: 0 };
    if (recente) atual.v30 += item.quantidade;
    else atual.v90 += item.quantidade;
    vendasPorProduto.set(produtoId, atual);
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

  const fullPorProduto = new Map<string, { disponivel: number; emTransito: number; indisponivel: number }>();
  for (const produto of produtos) {
    const anunciosFull = produto.ProdutoMercadoLivre.filter(
      (p) => p.mlLogisticType === "fulfillment" && p.mlStatus === "active"
    );
    if (anunciosFull.length === 0) continue;
    fullPorProduto.set(produto.id, {
      disponivel: anunciosFull.reduce((s, a) => s + (a.mlFullDisponivel ?? 0), 0),
      emTransito: anunciosFull.reduce((s, a) => s + (a.mlFullEmTransito ?? 0), 0),
      indisponivel: anunciosFull.reduce((s, a) => s + (a.mlFullIndisponivel ?? 0), 0),
    });
  }

  const estoqueLocalPorProduto = new Map(
    produtos.map((p) => [p.id, p.estoques.reduce((sum, e) => sum + e.quantidade, 0)])
  );

  const unidadesEmKitsPorComponente = new Map<string, number>();
  for (const [kitId, componentes] of componentesPorKit) {
    const full = fullPorProduto.get(kitId);
    if (!full) continue;
    const kitsNoFull = full.disponivel + full.emTransito;
    if (kitsNoFull <= 0) continue;
    for (const componente of componentes) {
      unidadesEmKitsPorComponente.set(
        componente.produtoId,
        (unidadesEmKitsPorComponente.get(componente.produtoId) ?? 0) + kitsNoFull * componente.quantidade
      );
    }
  }

  const sugestoes = produtos.map((produto) => {
    const vendas = demandaExplodida.get(produto.id) ?? { v30: 0, v90: 0 };
    const config = configPorProduto.get(produto.id);
    const analysisPeriodDays = config?.analysisPeriodDays ?? 90;
    const componentesKit = produto.isKit ? componentesPorKit.get(produto.id) ?? [] : [];
    const estoqueLocal =
      produto.isKit && componentesKit.length > 0
        ? Math.min(
            ...componentesKit.map((c) =>
              c.quantidade > 0 ? Math.floor((estoqueLocalPorProduto.get(c.produtoId) ?? 0) / c.quantidade) : 0
            )
          )
        : estoqueLocalPorProduto.get(produto.id) ?? 0;
    const full = fullPorProduto.get(produto.id);
    const fornecedorPrincipal = produto.fornecedores[0];

    return calcularSugestaoReposicao({
      produtoId: produto.id,
      nome: produto.nome,
      sku: produto.sku,
      custoMedio: produto.custoMedio,
      vendas30Dias: vendas.v30,
      vendasPeriodoAnteriorDias: vendasNoPeriodoAnterior(vendas.v90, analysisPeriodDays),
      estoqueLocal,
      estoqueFullDisponivel: full?.disponivel ?? 0,
      estoqueFullEmTransito: full?.emTransito ?? 0,
      estoqueFullIndisponivel: full?.indisponivel ?? 0,
      pedidosEmAbertoUnidades: pedidosAbertosPorProduto.get(produto.id) ?? 0,
      estoqueEmKitsUnidades: unidadesEmKitsPorComponente.get(produto.id) ?? 0,
      ehKit: produto.isKit,
      temAnuncioFull: !!full,
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
        analysisPeriodDays,
      },
    });
  });

  return { sugestoes, parcial: false };
}

export interface ProdutoCapitalParado {
  produtoId: string;
  nome: string;
  sku: string;
  estoqueLocal: number;
  custoMedio: number | null;
  valorParado: number | null;
  ultimaVenda: string | null;
  diasSemVenda: number | null;
}

export function calcularCapitalParado(
  produtos: Array<{
    id: string;
    nome: string;
    sku: string;
    estoqueLocal: number;
    custoMedio: number | null;
  }>,
  ultimaVendaPorProduto: Map<string, Date>,
  limiteDias: number,
  agora: Date
): ProdutoCapitalParado[] {
  const resultado: ProdutoCapitalParado[] = [];

  for (const produto of produtos) {
    if (produto.estoqueLocal <= 0) continue;

    const ultimaVenda = ultimaVendaPorProduto.get(produto.id) ?? null;
    const diasSemVenda = ultimaVenda
      ? Math.floor((agora.getTime() - ultimaVenda.getTime()) / (24 * 60 * 60 * 1000))
      : null;

    if (diasSemVenda != null && diasSemVenda < limiteDias) continue;

    resultado.push({
      produtoId: produto.id,
      nome: produto.nome,
      sku: produto.sku,
      estoqueLocal: produto.estoqueLocal,
      custoMedio: produto.custoMedio,
      valorParado:
        produto.custoMedio != null ? produto.custoMedio * produto.estoqueLocal : null,
      ultimaVenda: ultimaVenda ? ultimaVenda.toISOString().slice(0, 10) : null,
      diasSemVenda,
    });
  }

  return resultado.sort((a, b) => (b.valorParado ?? 0) - (a.valorParado ?? 0));
}

export async function calcularCapitalParadoConta(
  userId: string,
  limiteDias: number
): Promise<ProdutoCapitalParado[]> {
  const agora = new Date();

  const [produtos, itensVendidos, saidas] = await Promise.all([
    prisma.produto.findMany({
      where: { userId, ativo: true },
      select: {
        id: true,
        nome: true,
        sku: true,
        custoMedio: true,
        estoques: {
          where: { armazem: { tipo: "LOCAL" } },
          select: { quantidade: true },
        },
      },
    }),
    prisma.vendaCanalItem.findMany({
      where: {
        produtoId: { not: null },
        venda: { userId, status: { in: STATUS_VENDA_VALIDOS } },
      },
      select: { produtoId: true, venda: { select: { dataVenda: true } } },
    }),
    prisma.detalhesSaida.findMany({
      where: { saida: { userId } },
      select: { produtoId: true, saida: { select: { data: true } } },
    }),
  ]);

  const ultimaVendaPorProduto = new Map<string, Date>();
  for (const item of itensVendidos) {
    const produtoId = item.produtoId as string;
    const atual = ultimaVendaPorProduto.get(produtoId);
    if (!atual || item.venda.dataVenda > atual) {
      ultimaVendaPorProduto.set(produtoId, item.venda.dataVenda);
    }
  }
  for (const saida of saidas) {
    const atual = ultimaVendaPorProduto.get(saida.produtoId);
    if (!atual || saida.saida.data > atual) {
      ultimaVendaPorProduto.set(saida.produtoId, saida.saida.data);
    }
  }

  const produtosComEstoque = produtos.map((p) => ({
    id: p.id,
    nome: p.nome,
    sku: p.sku,
    custoMedio: p.custoMedio,
    estoqueLocal: p.estoques.reduce((sum, e) => sum + e.quantidade, 0),
  }));

  return calcularCapitalParado(produtosComEstoque, ultimaVendaPorProduto, limiteDias, agora);
}
