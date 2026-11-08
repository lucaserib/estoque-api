import { CanalVenda, Confianca, FreteOrigem, StatusVendaCanal, TipoValorFreteLogistica } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calcularCustoKit } from "@/lib/custo";
import { obterAdaptador } from "../canais/registro";
import type {
  AdaptadorCanalFinanceiro,
  ContaCanal,
  PagamentoNormalizado,
  VendaCanalNormalizada,
} from "../canais/tipos";
import {
  calcularResultadoVenda,
  ratearCustoVendaPorItem,
  type ItemVendaEntrada,
  type ResultadoVenda,
} from "../dominio/formulas";
import { ratear } from "../dominio/dinheiro";
import { resolverOrigemCanonica } from "./deduplicacao";
import { vincularProduto } from "./vinculo";
import { invalidarCacheFinanceiro } from "../relatorios/cache";

const PENDENCIA_SEM_VINCULO = "SEM_VINCULO";
const PENDENCIA_LIBERACAO_ESTIMADA = "LIBERACAO_ESTIMADA";
const PENDENCIA_VINCULO_NAO_CONFIRMADO = "VINCULO_NAO_CONFIRMADO";
const TENTATIVAS_MAXIMAS_ERRO = 5;

export function tempoMaximoLoteMs(): number {
  return Number(process.env.FINANCEIRO_TEMPO_MAXIMO_LOTE_MS ?? 40000);
}

export function mensagemDeErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : "Erro desconhecido";
}

export async function registrarErroPedido(
  userId: string,
  canal: CanalVenda,
  pedidoExternoId: string,
  etapa: string,
  mensagem: string
): Promise<void> {
  await prisma.sincronizacaoFinanceiraErro.upsert({
    where: { userId_canal_pedidoExternoId_etapa: { userId, canal, pedidoExternoId, etapa } },
    create: { userId, canal, pedidoExternoId, etapa, mensagem },
    update: { mensagem, tentativas: { increment: 1 }, ultimoErroEm: new Date(), resolvidoEm: null },
  });
}

export async function resolverErroPedido(
  userId: string,
  canal: CanalVenda,
  pedidoExternoId: string
): Promise<void> {
  await prisma.sincronizacaoFinanceiraErro.updateMany({
    where: { userId, canal, pedidoExternoId, resolvidoEm: null },
    data: { resolvidoEm: new Date() },
  });
}

export async function ingerirPedidoComRegistroDeErro(
  accountId: string,
  userId: string,
  canal: CanalVenda,
  pedidoExternoId: string,
  etapa: string
): Promise<void> {
  const erroAnterior = await prisma.sincronizacaoFinanceiraErro.findUnique({
    where: { userId_canal_pedidoExternoId_etapa: { userId, canal, pedidoExternoId, etapa } },
  });
  if (erroAnterior && erroAnterior.resolvidoEm == null && erroAnterior.tentativas >= TENTATIVAS_MAXIMAS_ERRO) {
    return;
  }

  try {
    await ingerirPedidoMercadoLivre(accountId, pedidoExternoId);
    await resolverErroPedido(userId, canal, pedidoExternoId);
  } catch (erro) {
    await registrarErroPedido(userId, canal, pedidoExternoId, etapa, mensagemDeErro(erro));
  }
}

function statusZeraQuantidade(status: StatusVendaCanal): boolean {
  return status === StatusVendaCanal.CANCELADA || status === StatusVendaCanal.DEVOLVIDA;
}

function calcularValorLiquidoReceber(resultado: ResultadoVenda): number | null {
  if (resultado.tarifa == null || resultado.freteVendedor == null) return null;
  return resultado.faturamentoBruto - resultado.tarifa - resultado.freteVendedor;
}

interface InfoCustoProduto {
  custoUnitario: number | null;
  custoFreteManual: number | null;
}

async function resolverCustoAtualDoProduto(produtoId: string): Promise<InfoCustoProduto> {
  const produto = await prisma.produto.findUnique({
    where: { id: produtoId },
    select: { isKit: true, custoMedio: true, custoFreteManual: true, custoEmbalagem: true },
  });
  if (!produto) return { custoUnitario: null, custoFreteManual: null };

  let custoMedio: number | null;
  if (!produto.isKit) {
    custoMedio = produto.custoMedio;
  } else {
    const kit = await calcularCustoKit(produtoId);
    custoMedio = kit.completo ? kit.custoMedio : null;
  }

  const custoUnitario = custoMedio == null ? null : custoMedio + (produto.custoEmbalagem ?? 0);
  return { custoUnitario, custoFreteManual: produto.custoFreteManual };
}

interface RegraFreteLogisticaInfo {
  tipoValor: TipoValorFreteLogistica;
  valor: number;
  percentual: number;
}

export interface ConfigIngestao {
  aliquotaImposto: number;
  custoEnvioFlex: number | null;
  diasLiberacaoPadrao: number;
  regrasFreteLogistica: Map<string, RegraFreteLogisticaInfo>;
}

export async function obterConfigIngestao(userId: string): Promise<ConfigIngestao> {
  const [config, regras] = await Promise.all([
    prisma.configuracaoGeral.findUnique({
      where: { userId },
      select: { aliquotaImposto: true, custoEnvioFlex: true, diasLiberacaoPadrao: true },
    }),
    prisma.regraFreteLogistica.findMany({ where: { userId } }),
  ]);
  return {
    aliquotaImposto: config?.aliquotaImposto ?? 0,
    custoEnvioFlex: config?.custoEnvioFlex ?? null,
    diasLiberacaoPadrao: config?.diasLiberacaoPadrao ?? 14,
    regrasFreteLogistica: new Map(
      regras.map((r) => [r.logistica, { tipoValor: r.tipoValor, valor: r.valor, percentual: r.percentual }])
    ),
  };
}

function resolverPadraoLogistica(
  logistica: string | null,
  config: ConfigIngestao,
  faturamentoBruto: number
): number | null {
  if (logistica) {
    const regra = config.regrasFreteLogistica.get(logistica);
    if (regra) {
      return regra.tipoValor === TipoValorFreteLogistica.FIXO
        ? regra.valor
        : Math.round(faturamentoBruto * regra.percentual);
    }
  }
  if (logistica === "self_service") return config.custoEnvioFlex;
  return null;
}

async function resolverLogisticaReal(
  contaCanal: ContaCanal,
  adaptador: AdaptadorCanalFinanceiro,
  normalizado: VendaCanalNormalizada
): Promise<string | null> {
  if (normalizado.logistica) return normalizado.logistica;
  if (!normalizado.envioExternoId || !adaptador.obterEnvio) return null;

  const envio = await adaptador.obterEnvio(contaCanal, normalizado.envioExternoId);
  return envio.logistica;
}

interface LiberacaoResolvida {
  dataLiberacao: Date | null;
  valorLiquidoOverride: number | null;
  estimado: boolean;
}

async function resolverLiberacao(
  contaCanal: ContaCanal,
  adaptador: AdaptadorCanalFinanceiro,
  normalizado: VendaCanalNormalizada,
  diasLiberacaoPadrao: number
): Promise<LiberacaoResolvida> {
  if (normalizado.dataLiberacao) {
    return { dataLiberacao: normalizado.dataLiberacao, valorLiquidoOverride: null, estimado: false };
  }

  if (adaptador.obterLiberacaoPagamento) {
    const liberacao = await adaptador.obterLiberacaoPagamento(contaCanal, normalizado.pedidoExternoId);
    if (liberacao.dataLiberacao) {
      return {
        dataLiberacao: liberacao.dataLiberacao,
        valorLiquidoOverride: liberacao.valorLiquido,
        estimado: liberacao.confianca === Confianca.ESTIMADO,
      };
    }
  }

  if (normalizado.status !== StatusVendaCanal.PAGA) {
    return { dataLiberacao: null, valorLiquidoOverride: null, estimado: false };
  }

  const estimativa = new Date(
    normalizado.dataVenda.getTime() + diasLiberacaoPadrao * 24 * 60 * 60 * 1000
  );
  return { dataLiberacao: estimativa, valorLiquidoOverride: null, estimado: true };
}

async function resolverPagamentoDetalhado(
  contaCanal: ContaCanal,
  adaptador: AdaptadorCanalFinanceiro,
  normalizado: VendaCanalNormalizada
): Promise<PagamentoNormalizado | null> {
  if (!normalizado.pagamentoExternoId || !adaptador.obterPagamentoDetalhado) return null;

  try {
    return await adaptador.obterPagamentoDetalhado(contaCanal, normalizado.pagamentoExternoId);
  } catch (erro) {
    console.error("[PAGAMENTO_ML] Erro ao buscar detalhe do pagamento:", erro);
    return null;
  }
}

function aplicarTarifaConfirmada(
  itensEntrada: ItemVendaEntrada[],
  pagamento: PagamentoNormalizado
): void {
  const tarifasRateadas = ratearCustoVendaPorItem(pagamento.tarifaVenda, itensEntrada);
  itensEntrada.forEach((item, i) => {
    item.tarifaTotal = tarifasRateadas[i];
  });
}

interface ResolucaoFrete {
  valor: number | null;
  origem: FreteOrigem;
}

function somarCustoFreteProduto(
  itensEntrada: ItemVendaEntrada[],
  custosFreteManualPorItem: Array<number | null>
): number | null {
  let soma = 0;
  for (let i = 0; i < itensEntrada.length; i++) {
    if (!itensEntrada[i].produtoId || custosFreteManualPorItem[i] == null) return null;
    soma += (custosFreteManualPorItem[i] as number) * itensEntrada[i].quantidade;
  }
  return soma;
}

async function resolverFrete(
  contaCanal: ContaCanal,
  adaptador: AdaptadorCanalFinanceiro,
  normalizado: VendaCanalNormalizada,
  config: ConfigIngestao,
  pagamento: PagamentoNormalizado | null,
  freteAjusteManualExistente: number | null,
  itensEntrada: ItemVendaEntrada[],
  custosFreteManualPorItem: Array<number | null>,
  faturamentoBruto: number
): Promise<ResolucaoFrete> {
  if (freteAjusteManualExistente != null) {
    return { valor: freteAjusteManualExistente, origem: FreteOrigem.AJUSTE_MANUAL };
  }

  if (!normalizado.envioExternoId) {
    return { valor: 0, origem: FreteOrigem.DESCONHECIDO };
  }

  if (pagamento) {
    return { valor: pagamento.freteVendedor, origem: FreteOrigem.PAGAMENTO_CONFIRMADO };
  }

  if (normalizado.logistica !== "self_service" && adaptador.obterCustoEnvio) {
    const custo = await adaptador.obterCustoEnvio(contaCanal, normalizado.envioExternoId);
    if (custo.valor != null) {
      const valorFinal = !normalizado.pacoteExternoId
        ? custo.valor
        : await ratearFreteDoPacoteEAtualizarIrmaos(
            contaCanal.userId,
            adaptador.canal,
            normalizado,
            custo.valor
          );
      return { valor: valorFinal, origem: FreteOrigem.CUSTO_ENVIO_CANAL };
    }
  }

  const custoPorProduto = somarCustoFreteProduto(itensEntrada, custosFreteManualPorItem);
  if (custoPorProduto != null) {
    return { valor: custoPorProduto, origem: FreteOrigem.CUSTO_PRODUTO };
  }

  const padrao = resolverPadraoLogistica(normalizado.logistica, config, faturamentoBruto);
  if (padrao != null) {
    return { valor: padrao, origem: FreteOrigem.PADRAO_LOGISTICA };
  }

  return { valor: null, origem: FreteOrigem.DESCONHECIDO };
}

async function ratearFreteDoPacoteEAtualizarIrmaos(
  userId: string,
  canal: CanalVenda,
  normalizado: VendaCanalNormalizada,
  custoTotalEnvio: number
): Promise<number> {
  const irmaos = await prisma.vendaCanal.findMany({
    where: {
      userId,
      canal,
      pacoteExternoId: normalizado.pacoteExternoId,
      pedidoExternoId: { not: normalizado.pedidoExternoId },
      freteAjusteManual: null,
    },
    select: { id: true, faturamentoBruto: true },
  });

  const faturamentoAtual = normalizado.itens.reduce(
    (soma, item) => soma + item.precoUnitario * item.quantidade,
    0
  );
  const pesos = [...irmaos.map((i) => i.faturamentoBruto), faturamentoAtual];
  const partes = ratear(custoTotalEnvio, pesos);

  for (let i = 0; i < irmaos.length; i++) {
    await recalcularEPersistirMargem(irmaos[i].id, {
      freteTotal: partes[i],
      freteOrigem: FreteOrigem.CUSTO_ENVIO_CANAL,
    });
  }

  return partes[partes.length - 1];
}

interface SobrescritasRecalculo {
  freteTotal?: number;
  adsAtribuido?: number;
  freteOrigem?: FreteOrigem;
  forcarPersistencia?: boolean;
}

export async function recalcularEPersistirMargem(
  vendaId: string,
  sobrescritas: SobrescritasRecalculo
): Promise<void> {
  const venda = await prisma.vendaCanal.findUniqueOrThrow({
    where: { id: vendaId },
    include: { itens: true },
  });

  const freteTotal = sobrescritas.freteTotal ?? venda.freteVendedor;
  const adsAtribuido = sobrescritas.adsAtribuido ?? venda.adsAtribuido;
  if (
    !sobrescritas.forcarPersistencia &&
    freteTotal === venda.freteVendedor &&
    adsAtribuido === venda.adsAtribuido
  ) {
    return;
  }

  const config = await obterConfigIngestao(venda.userId);
  const zerar = statusZeraQuantidade(venda.status);

  const itensEntrada: ItemVendaEntrada[] = venda.itens.map((item) => ({
    produtoId: item.produtoId,
    quantidade: zerar ? 0 : item.quantidade,
    precoUnitario: item.precoUnitario,
    tarifaTotal: item.tarifaVenda,
    descontoVendedorTotal: item.descontoRateado,
    custoUnitario: item.custoUnitario,
  }));

  const resultado = calcularResultadoVenda(
    { freteTotal, adsAtribuido },
    itensEntrada,
    { aliquotaImposto: config.aliquotaImposto }
  );
  const semVinculo = venda.itens.some((item) => item.produtoId === null);

  await prisma.$transaction(async (tx) => {
    await tx.vendaCanal.update({
      where: { id: vendaId },
      data: {
        freteVendedor: resultado.freteVendedor,
        adsAtribuido: resultado.adsAtribuido,
        margemContribuicao: resultado.margemContribuicao,
        valorLiquidoReceber: calcularValorLiquidoReceber(resultado),
        completo: resultado.completo && !semVinculo,
        faltando: semVinculo
          ? [...new Set([...resultado.faltando, PENDENCIA_SEM_VINCULO])]
          : resultado.faltando,
        ...(sobrescritas.freteOrigem != null ? { freteOrigem: sobrescritas.freteOrigem } : {}),
      },
    });
    for (let i = 0; i < venda.itens.length; i++) {
      await tx.vendaCanalItem.update({
        where: { id: venda.itens[i].id },
        data: {
          freteRateado: resultado.itens[i].freteRateado,
          adsRateado: resultado.itens[i].adsRateado,
          margemContribuicao: resultado.itens[i].margemContribuicao,
        },
      });
    }
  });

  await invalidarCacheFinanceiro(venda.userId);
}

export async function definirAjusteManualFrete(
  vendaId: string,
  valor: number,
  motivo: string,
  userId: string
): Promise<void> {
  await prisma.vendaCanal.update({
    where: { id: vendaId },
    data: {
      freteAjusteManual: valor,
      freteAjusteManualMotivo: motivo,
      freteAjusteManualUserId: userId,
      freteAjusteManualEm: new Date(),
      freteOrigem: FreteOrigem.AJUSTE_MANUAL,
    },
  });
  await recalcularEPersistirMargem(vendaId, {
    freteTotal: valor,
    freteOrigem: FreteOrigem.AJUSTE_MANUAL,
    forcarPersistencia: true,
  });
}

export async function limparAjusteManualFrete(vendaId: string): Promise<void> {
  const venda = await prisma.vendaCanal.update({
    where: { id: vendaId },
    data: {
      freteAjusteManual: null,
      freteAjusteManualMotivo: null,
      freteAjusteManualUserId: null,
      freteAjusteManualEm: null,
    },
    select: { contaCanalId: true, pedidoExternoId: true },
  });
  await ingerirPedidoMercadoLivre(venda.contaCanalId, venda.pedidoExternoId);
}

interface ItensPreparados {
  itensEntrada: ItemVendaEntrada[];
  vinculos: Array<string | null>;
  descontosCusteadosMlRateados: number[];
  custosFreteManualPorItem: Array<number | null>;
  algumVinculoNaoConfirmado: boolean;
}

async function prepararItens(
  userId: string,
  accountId: string,
  normalizado: VendaCanalNormalizada,
  vendaExistente: {
    itens: Array<{
      anuncioExternoId: string;
      variacaoExternaId: string | null;
      produtoId: string | null;
      custoUnitario: number | null;
    }>;
  } | null
): Promise<ItensPreparados> {
  const vinculos: Array<string | null> = [];
  const zerar = statusZeraQuantidade(normalizado.status);
  const itensEntrada: ItemVendaEntrada[] = [];
  const custosFreteManualPorItem: Array<number | null> = [];
  let algumVinculoNaoConfirmado = false;

  for (const item of normalizado.itens) {
    const { produtoId, confirmado } = await vincularProduto(userId, accountId, item);
    vinculos.push(produtoId);
    if (!confirmado) algumVinculoNaoConfirmado = true;

    const itemExistente = vendaExistente?.itens.find(
      (i) =>
        i.anuncioExternoId === item.anuncioExternoId &&
        i.variacaoExternaId === item.variacaoExternaId
    );
    const custoCongelado =
      itemExistente && itemExistente.produtoId === produtoId ? itemExistente.custoUnitario : null;
    const infoProduto = produtoId ? await resolverCustoAtualDoProduto(produtoId) : null;
    const custoUnitario = custoCongelado ?? infoProduto?.custoUnitario ?? null;
    custosFreteManualPorItem.push(infoProduto?.custoFreteManual ?? null);

    itensEntrada.push({
      produtoId,
      quantidade: zerar ? 0 : item.quantidade,
      precoUnitario: item.precoUnitario,
      tarifaTotal: zerar ? 0 : item.tarifaTotal,
      descontoVendedorTotal: 0,
      custoUnitario,
    });
  }

  const descontosRateados = ratearCustoVendaPorItem(
    normalizado.descontoVendedorTotal,
    itensEntrada
  );
  itensEntrada.forEach((item, i) => {
    item.descontoVendedorTotal = descontosRateados[i];
  });

  const descontosCusteadosMlRateados = ratearCustoVendaPorItem(
    normalizado.descontoCusteadoPeloMlTotal,
    itensEntrada
  );

  return { itensEntrada, vinculos, descontosCusteadosMlRateados, custosFreteManualPorItem, algumVinculoNaoConfirmado };
}

export type ModoIngestao = "RAPIDO" | "COMPLETO";

const ORIGENS_FRETE_CONFIRMADAS: FreteOrigem[] = [
  FreteOrigem.PAGAMENTO_CONFIRMADO,
  FreteOrigem.CUSTO_ENVIO_CANAL,
];

type VendaExistenteComItens = NonNullable<Awaited<ReturnType<typeof buscarVendaExistente>>>;

async function buscarVendaExistente(userId: string, canal: CanalVenda, pedidoExternoId: string) {
  return prisma.vendaCanal.findUnique({
    where: { userId_canal_pedidoExternoId: { userId, canal, pedidoExternoId } },
    include: { itens: true },
  });
}

function resolverFreteSemChamadas(
  normalizado: VendaCanalNormalizada,
  vendaExistente: VendaExistenteComItens | null,
  config: ConfigIngestao,
  itensEntrada: ItemVendaEntrada[],
  custosFreteManualPorItem: Array<number | null>,
  faturamentoBruto: number
): ResolucaoFrete {
  if (vendaExistente?.freteAjusteManual != null) {
    return { valor: vendaExistente.freteAjusteManual, origem: FreteOrigem.AJUSTE_MANUAL };
  }
  if (!normalizado.envioExternoId) {
    return { valor: 0, origem: FreteOrigem.DESCONHECIDO };
  }
  if (
    vendaExistente?.freteVendedor != null &&
    ORIGENS_FRETE_CONFIRMADAS.includes(vendaExistente.freteOrigem)
  ) {
    return { valor: vendaExistente.freteVendedor, origem: vendaExistente.freteOrigem };
  }
  const custoPorProduto = somarCustoFreteProduto(itensEntrada, custosFreteManualPorItem);
  if (custoPorProduto != null) return { valor: custoPorProduto, origem: FreteOrigem.CUSTO_PRODUTO };
  const padrao = resolverPadraoLogistica(normalizado.logistica, config, faturamentoBruto);
  if (padrao != null) return { valor: padrao, origem: FreteOrigem.PADRAO_LOGISTICA };
  return { valor: null, origem: FreteOrigem.DESCONHECIDO };
}

function liberacaoSemChamadas(
  normalizado: VendaCanalNormalizada,
  vendaExistente: VendaExistenteComItens | null,
  diasLiberacaoPadrao: number
): LiberacaoResolvida {
  if (normalizado.dataLiberacao) {
    return { dataLiberacao: normalizado.dataLiberacao, valorLiquidoOverride: null, estimado: false };
  }
  if (vendaExistente?.dataLiberacao && !vendaExistente.faltando.includes(PENDENCIA_LIBERACAO_ESTIMADA)) {
    return {
      dataLiberacao: vendaExistente.dataLiberacao,
      valorLiquidoOverride: vendaExistente.valorLiquidoReceber,
      estimado: false,
    };
  }
  if (normalizado.status !== StatusVendaCanal.PAGA) {
    return { dataLiberacao: null, valorLiquidoOverride: null, estimado: false };
  }
  return {
    dataLiberacao: new Date(normalizado.dataVenda.getTime() + diasLiberacaoPadrao * 24 * 60 * 60 * 1000),
    valorLiquidoOverride: null,
    estimado: true,
  };
}

export interface OpcoesPersistencia {
  modo: ModoIngestao;
  config?: ConfigIngestao;
  vendaExistente?: VendaExistenteComItens | null;
}

export async function persistirVendaNormalizada(
  contaCanal: ContaCanal,
  adaptador: AdaptadorCanalFinanceiro,
  normalizadoOriginal: VendaCanalNormalizada,
  opcoes: OpcoesPersistencia = { modo: "COMPLETO" }
): Promise<void> {
  const origem = resolverOrigemCanonica(
    { canal: adaptador.canal, pedidoExternoId: normalizadoOriginal.pedidoExternoId },
    normalizadoOriginal.origemReal
  );
  const { userId } = contaCanal;
  const completo = opcoes.modo === "COMPLETO";

  const config = opcoes.config ?? (await obterConfigIngestao(userId));
  const vendaExistente =
    opcoes.vendaExistente !== undefined
      ? opcoes.vendaExistente
      : await buscarVendaExistente(userId, origem.canal, origem.pedidoExternoId);

  normalizadoOriginal.logistica = completo
    ? await resolverLogisticaReal(contaCanal, adaptador, normalizadoOriginal)
    : normalizadoOriginal.logistica ?? vendaExistente?.logistica ?? null;

  const { itensEntrada, vinculos, descontosCusteadosMlRateados, custosFreteManualPorItem, algumVinculoNaoConfirmado } =
    await prepararItens(userId, contaCanal.contaCanalId, normalizadoOriginal, vendaExistente);

  if (!completo && vendaExistente && normalizadoOriginal.descontoVendedorTotal === 0) {
    const descontosExistentes = ratearCustoVendaPorItem(vendaExistente.descontoVendedor, itensEntrada);
    itensEntrada.forEach((item, i) => {
      item.descontoVendedorTotal = descontosExistentes[i];
    });
  }

  const pagamento = completo
    ? await resolverPagamentoDetalhado(contaCanal, adaptador, normalizadoOriginal)
    : null;
  if (pagamento) {
    aplicarTarifaConfirmada(itensEntrada, pagamento);
  }

  const faturamentoBrutoOriginal = normalizadoOriginal.itens.reduce(
    (soma, item) => soma + item.precoUnitario * item.quantidade,
    0
  );

  const frete = completo
    ? await resolverFrete(
        contaCanal,
        adaptador,
        normalizadoOriginal,
        config,
        pagamento,
        vendaExistente?.freteAjusteManual ?? null,
        itensEntrada,
        custosFreteManualPorItem,
        faturamentoBrutoOriginal
      )
    : resolverFreteSemChamadas(
        normalizadoOriginal,
        vendaExistente,
        config,
        itensEntrada,
        custosFreteManualPorItem,
        faturamentoBrutoOriginal
      );
  const freteTotalPedido = frete.valor;

  const liberacao: LiberacaoResolvida =
    pagamento?.dataLiberacao
      ? { dataLiberacao: pagamento.dataLiberacao, valorLiquidoOverride: null, estimado: false }
      : completo
        ? await resolverLiberacao(contaCanal, adaptador, normalizadoOriginal, config.diasLiberacaoPadrao)
        : liberacaoSemChamadas(normalizadoOriginal, vendaExistente, config.diasLiberacaoPadrao);

  const resultado: ResultadoVenda = calcularResultadoVenda(
    { freteTotal: freteTotalPedido, adsAtribuido: vendaExistente?.adsAtribuido ?? 0 },
    itensEntrada,
    { aliquotaImposto: config.aliquotaImposto }
  );

  const semVinculo = vinculos.some((v) => v === null);
  const vendaCompleta = resultado.completo && !semVinculo;
  const faltando = [
    ...new Set([
      ...resultado.faltando,
      ...(semVinculo ? [PENDENCIA_SEM_VINCULO] : []),
      ...(liberacao.estimado ? [PENDENCIA_LIBERACAO_ESTIMADA] : []),
      ...(algumVinculoNaoConfirmado ? [PENDENCIA_VINCULO_NAO_CONFIRMADO] : []),
    ]),
  ];

  const valorLiquidoReceber =
    pagamento?.valorLiquidoReceber ??
    liberacao.valorLiquidoOverride ??
    calcularValorLiquidoReceber(resultado);

  const dadosComuns = {
    pacoteExternoId: normalizadoOriginal.pacoteExternoId,
    dataVenda: normalizadoOriginal.dataVenda,
    dataCancelamento: normalizadoOriginal.dataCancelamento,
    dataLiberacao: liberacao.dataLiberacao,
    status: normalizadoOriginal.status,
    logistica: normalizadoOriginal.logistica,
    envioExternoId: normalizadoOriginal.envioExternoId,
    faturamentoBruto: faturamentoBrutoOriginal,
    valorEstornado: normalizadoOriginal.valorEstornado ?? 0,
    descontoVendedor: resultado.descontoVendedor,
    tarifaVenda: resultado.tarifa ?? 0,
    freteVendedor: resultado.freteVendedor,
    freteComprador: normalizadoOriginal.freteComprador,
    impostoEstimado: resultado.imposto,
    adsAtribuido: resultado.adsAtribuido,
    cmv: resultado.cmv,
    outrosCustos: 0,
    margemContribuicao: resultado.margemContribuicao,
    valorLiquidoReceber,
    retencaoDividas: pagamento?.retencaoDividas ?? vendaExistente?.retencaoDividas ?? 0,
    statusLiberacao: pagamento?.statusLiberacao ?? vendaExistente?.statusLiberacao ?? null,
    completo: vendaCompleta,
    faltando,
    freteConfianca:
      frete.origem === FreteOrigem.PAGAMENTO_CONFIRMADO ||
      frete.origem === FreteOrigem.CUSTO_ENVIO_CANAL ||
      frete.origem === FreteOrigem.AJUSTE_MANUAL
        ? Confianca.CONFIRMADO
        : Confianca.ESTIMADO,
    freteOrigem: frete.origem,
    atualizadoNoCanalEm: normalizadoOriginal.atualizadoNoCanalEm,
    enriquecidoEm: completo ? new Date() : null,
    ...(completo ? { enriquecimentoErro: null } : {}),
  };

  const venda = await prisma.vendaCanal.upsert({
    where: {
      userId_canal_pedidoExternoId: {
        userId,
        canal: origem.canal,
        pedidoExternoId: origem.pedidoExternoId,
      },
    },
    create: {
      userId,
      canal: origem.canal,
      contaCanalId: contaCanal.contaCanalId,
      pedidoExternoId: origem.pedidoExternoId,
      ...dadosComuns,
    },
    update: dadosComuns,
  });

  await prisma.$transaction([
    prisma.vendaCanalItem.deleteMany({ where: { vendaId: venda.id } }),
    prisma.vendaCanalItem.createMany({
      data: normalizadoOriginal.itens.map((item, i) => ({
        vendaId: venda.id,
        produtoId: vinculos[i],
        sku: item.sku,
        anuncioExternoId: item.anuncioExternoId,
        variacaoExternaId: item.variacaoExternaId,
        titulo: item.titulo,
        quantidade: item.quantidade,
        precoUnitario: item.precoUnitario,
        precoCheio: item.precoCheio,
        tarifaVenda: resultado.itens[i].tarifa ?? 0,
        freteRateado: resultado.itens[i].freteRateado,
        descontoRateado: resultado.itens[i].descontoVendedor,
        impostoRateado: resultado.itens[i].imposto,
        adsRateado: resultado.itens[i].adsRateado,
        custoUnitario: itensEntrada[i].custoUnitario,
        margemContribuicao: resultado.itens[i].margemContribuicao,
        descontoCusteadoMl: descontosCusteadosMlRateados[i],
      })),
    }),
  ]);

  if (pagamento) {
    await persistirCobrancasPagamento(venda.id, pagamento);
  }
}

async function persistirCobrancasPagamento(
  vendaId: string,
  pagamento: PagamentoNormalizado
): Promise<void> {
  for (const cobranca of pagamento.cobrancas) {
    await prisma.cobrancaPagamento.upsert({
      where: {
        vendaId_pagamentoExternoId_nome: {
          vendaId,
          pagamentoExternoId: pagamento.pagamentoExternoId,
          nome: cobranca.nome,
        },
      },
      create: {
        vendaId,
        pagamentoExternoId: pagamento.pagamentoExternoId,
        nome: cobranca.nome,
        tipo: cobranca.tipo,
        valor: cobranca.valor,
        estornado: cobranca.estornado,
        destino: cobranca.destino,
        metadata: cobranca.metadata ?? undefined,
      },
      update: {
        tipo: cobranca.tipo,
        valor: cobranca.valor,
        estornado: cobranca.estornado,
        destino: cobranca.destino,
        metadata: cobranca.metadata ?? undefined,
      },
    });
  }
}

export async function atualizarResumoDoDia(
  userId: string,
  _canal?: CanalVenda,
  _algumInstanteDoDia?: Date
): Promise<void> {
  await invalidarCacheFinanceiro(userId);
}

export async function ingerirPedidoMercadoLivre(
  accountId: string,
  pedidoExternoId: string
): Promise<{ ingerido: boolean; motivo?: string }> {
  const conta = await prisma.mercadoLivreAccount.findUnique({
    where: { id: accountId },
    select: { userId: true },
  });
  if (!conta) return { ingerido: false, motivo: "CONTA_NAO_ENCONTRADA" };

  const contaCanal: ContaCanal = { contaCanalId: accountId, userId: conta.userId };
  const adaptador = obterAdaptador(CanalVenda.MERCADO_LIVRE);

  const normalizado = await adaptador.obterPedido(contaCanal, pedidoExternoId);
  if (!normalizado) return { ingerido: false, motivo: "NAO_RELEVANTE_AINDA" };

  await persistirVendaNormalizada(contaCanal, adaptador, normalizado, { modo: "COMPLETO" });
  await invalidarCacheFinanceiro(conta.userId);
  return { ingerido: true };
}

export async function ingerirVendaNormalizada(
  contaCanal: ContaCanal,
  adaptador: AdaptadorCanalFinanceiro,
  normalizado: VendaCanalNormalizada,
  modo: ModoIngestao = "COMPLETO"
): Promise<void> {
  await persistirVendaNormalizada(contaCanal, adaptador, normalizado, { modo });
  await invalidarCacheFinanceiro(contaCanal.userId);
}

export async function obterUserIdDaConta(accountId: string): Promise<string | null> {
  const conta = await prisma.mercadoLivreAccount.findUnique({
    where: { id: accountId },
    select: { userId: true },
  });
  return conta?.userId ?? null;
}

export async function reprocessarErrosPendentes(accountId: string): Promise<{ processados: number }> {
  const conta = await prisma.mercadoLivreAccount.findUniqueOrThrow({
    where: { id: accountId },
    select: { userId: true },
  });
  const canal = CanalVenda.MERCADO_LIVRE;

  const erros = await prisma.sincronizacaoFinanceiraErro.findMany({
    where: { userId: conta.userId, canal, resolvidoEm: null, tentativas: { lt: TENTATIVAS_MAXIMAS_ERRO } },
  });

  let processados = 0;
  for (const erro of erros) {
    await ingerirPedidoComRegistroDeErro(accountId, conta.userId, canal, erro.pedidoExternoId, erro.etapa);
    processados++;
  }

  return { processados };
}

export async function revincularVendasDoAnuncio(params: {
  userId: string;
  contaCanalId: string;
  anuncioExternoId: string;
  produtoId: string | null;
}): Promise<number> {
  const { userId, contaCanalId, anuncioExternoId, produtoId } = params;

  const vendas = await prisma.vendaCanal.findMany({
    where: {
      userId,
      contaCanalId,
      itens: { some: { anuncioExternoId } },
    },
    include: { itens: true },
  });
  if (vendas.length === 0) return 0;

  const config = await obterConfigIngestao(userId);
  const custoNovo = produtoId ? (await resolverCustoAtualDoProduto(produtoId)).custoUnitario : null;
  const PENDENCIAS_CALCULADAS = new Set([
    "SEM_CUSTO",
    "SEM_TARIFA",
    "SEM_FRETE",
    PENDENCIA_SEM_VINCULO,
    PENDENCIA_VINCULO_NAO_CONFIRMADO,
  ]);

  for (const venda of vendas) {
    const zerar = statusZeraQuantidade(venda.status);
    const itens = venda.itens.map((item) =>
      item.anuncioExternoId === anuncioExternoId
        ? {
            ...item,
            produtoId,
            custoUnitario:
              item.produtoId === produtoId && item.custoUnitario != null ? item.custoUnitario : custoNovo,
          }
        : item
    );

    const resultado = calcularResultadoVenda(
      { freteTotal: venda.freteVendedor, adsAtribuido: venda.adsAtribuido },
      itens.map((item) => ({
        produtoId: item.produtoId,
        quantidade: zerar ? 0 : item.quantidade,
        precoUnitario: item.precoUnitario,
        tarifaTotal: item.tarifaVenda,
        descontoVendedorTotal: item.descontoRateado,
        custoUnitario: item.custoUnitario,
      })),
      { aliquotaImposto: config.aliquotaImposto }
    );
    const semVinculo = itens.some((item) => item.produtoId === null);
    const faltando = [
      ...new Set([
        ...venda.faltando.filter((f) => !PENDENCIAS_CALCULADAS.has(f)),
        ...resultado.faltando,
        ...(semVinculo ? [PENDENCIA_SEM_VINCULO] : []),
      ]),
    ];

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < itens.length; i++) {
        if (itens[i].anuncioExternoId !== anuncioExternoId) continue;
        await tx.vendaCanalItem.update({
          where: { id: itens[i].id },
          data: {
            produtoId: itens[i].produtoId,
            custoUnitario: itens[i].custoUnitario,
            margemContribuicao: resultado.itens[i].margemContribuicao,
          },
        });
      }
      await tx.vendaCanal.update({
        where: { id: venda.id },
        data: {
          cmv: resultado.cmv,
          margemContribuicao: resultado.margemContribuicao,
          completo: resultado.completo && !semVinculo,
          faltando,
        },
      });
    });
  }

  await invalidarCacheFinanceiro(userId);
  return vendas.length;
}

export interface ResultadoPreenchimentoCusto {
  vendasAtualizadas: number;
  itensPreenchidos: number;
  restantes: boolean;
}

async function produtosAfetadosPeloCusto(userId: string, produtoIds: string[]): Promise<string[]> {
  const kits = await prisma.componente.findMany({
    where: { produtoId: { in: produtoIds }, kit: { userId } },
    select: { kitId: true },
  });
  return [...new Set([...produtoIds, ...kits.map((k) => k.kitId)])];
}

export async function preencherCustoDasVendasSemCusto(params: {
  userId: string;
  produtoIds?: string[];
  limite?: number;
}): Promise<ResultadoPreenchimentoCusto> {
  const { userId } = params;
  const limite = params.limite ?? 300;
  const produtos = params.produtoIds?.length ? await produtosAfetadosPeloCusto(userId, params.produtoIds) : null;

  const vendas = await prisma.vendaCanal.findMany({
    where: {
      userId,
      itens: { some: { custoUnitario: null, produtoId: produtos ? { in: produtos } : { not: null } } },
    },
    include: { itens: true },
    orderBy: { dataVenda: "desc" },
    take: limite + 1,
  });
  const restantes = vendas.length > limite;
  if (vendas.length === 0) return { vendasAtualizadas: 0, itensPreenchidos: 0, restantes: false };

  const config = await obterConfigIngestao(userId);
  const custos = new Map<string, number | null>();
  const custoDe = async (produtoId: string) => {
    if (!custos.has(produtoId)) custos.set(produtoId, (await resolverCustoAtualDoProduto(produtoId)).custoUnitario);
    return custos.get(produtoId) ?? null;
  };
  const PENDENCIAS_CALCULADAS = new Set(["SEM_CUSTO", "SEM_TARIFA", "SEM_FRETE", PENDENCIA_SEM_VINCULO]);

  let vendasAtualizadas = 0;
  let itensPreenchidos = 0;
  for (const venda of vendas.slice(0, limite)) {
    const itens = await Promise.all(
      venda.itens.map(async (item) =>
        item.custoUnitario == null && item.produtoId ? { ...item, custoUnitario: await custoDe(item.produtoId) } : item
      )
    );
    const preenchidos = itens.filter((item, i) => venda.itens[i].custoUnitario == null && item.custoUnitario != null);
    if (preenchidos.length === 0) continue;

    const zerar = statusZeraQuantidade(venda.status);
    const resultado = calcularResultadoVenda(
      { freteTotal: venda.freteVendedor, adsAtribuido: venda.adsAtribuido },
      itens.map((item) => ({
        produtoId: item.produtoId,
        quantidade: zerar ? 0 : item.quantidade,
        precoUnitario: item.precoUnitario,
        tarifaTotal: item.tarifaVenda,
        descontoVendedorTotal: item.descontoRateado,
        custoUnitario: item.custoUnitario,
      })),
      { aliquotaImposto: config.aliquotaImposto }
    );
    const semVinculo = itens.some((item) => item.produtoId === null);

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < itens.length; i++) {
        if (venda.itens[i].custoUnitario != null || itens[i].custoUnitario == null) continue;
        await tx.vendaCanalItem.update({
          where: { id: itens[i].id },
          data: { custoUnitario: itens[i].custoUnitario, margemContribuicao: resultado.itens[i].margemContribuicao },
        });
      }
      await tx.vendaCanal.update({
        where: { id: venda.id },
        data: {
          cmv: resultado.cmv,
          margemContribuicao: resultado.margemContribuicao,
          completo: resultado.completo && !semVinculo,
          faltando: [
            ...new Set([
              ...venda.faltando.filter((f) => !PENDENCIAS_CALCULADAS.has(f)),
              ...resultado.faltando,
              ...(semVinculo ? [PENDENCIA_SEM_VINCULO] : []),
            ]),
          ],
        },
      });
    });
    vendasAtualizadas++;
    itensPreenchidos += preenchidos.length;
  }

  if (vendasAtualizadas > 0) await invalidarCacheFinanceiro(userId);
  return { vendasAtualizadas, itensPreenchidos, restantes };
}

export async function atualizarCustoDasVendasAposMudanca(userId: string, produtoIds?: string[]) {
  try {
    return await preencherCustoDasVendasSemCusto({ userId, produtoIds });
  } catch (error) {
    console.error("[CUSTO_RETROATIVO] Falha ao preencher o custo das vendas", {
      conta: userId,
      produtos: produtoIds?.length ?? "todos",
      erro: error instanceof Error ? error.name : "desconhecido",
    });
    return null;
  }
}
