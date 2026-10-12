import {
  Confianca,
  OrigemLancamento,
  StatusLancamento,
  TipoContaFinanceira,
  TipoLancamento,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { seedPlanoContasPadrao } from "./planoContasPadrao";

/** Compra até o dia do fechamento (inclusive) entra na fatura que fecha nesse mês; depois, rola para a próxima. */
export function resolverMesReferenciaFatura(diaFechamento: number, dataCompra: Date): string {
  const dia = dataCompra.getUTCDate();
  const ano = dataCompra.getUTCFullYear();
  const mes = dataCompra.getUTCMonth();

  const [anoFatura, mesFatura] =
    dia <= diaFechamento ? [ano, mes] : mes === 11 ? [ano + 1, 0] : [ano, mes + 1];
  return `${anoFatura}-${String(mesFatura + 1).padStart(2, "0")}`;
}

function ultimoDiaDoMes(ano: number, mesIndiceZero: number): number {
  return new Date(Date.UTC(ano, mesIndiceZero + 1, 0)).getUTCDate();
}

/** Vencimento cai no mesmo mês do fechamento se o dia de vencimento vier depois do dia de fechamento; senão, no mês seguinte. */
export function calcularFechamentoEVencimento(
  diaFechamento: number,
  diaVencimento: number,
  mesReferencia: string
): { fechamento: Date; vencimento: Date } {
  const [ano, mes] = mesReferencia.split("-").map(Number);
  const mesIndiceZero = mes - 1;

  const fechamento = new Date(Date.UTC(ano, mesIndiceZero, Math.min(diaFechamento, ultimoDiaDoMes(ano, mesIndiceZero))));

  const vencimentoNoMesmoMes = diaVencimento > diaFechamento;
  const anoVenc = vencimentoNoMesmoMes ? ano : mesIndiceZero === 11 ? ano + 1 : ano;
  const mesVencIndiceZero = vencimentoNoMesmoMes ? mesIndiceZero : mesIndiceZero === 11 ? 0 : mesIndiceZero + 1;
  const vencimento = new Date(
    Date.UTC(anoVenc, mesVencIndiceZero, Math.min(diaVencimento, ultimoDiaDoMes(anoVenc, mesVencIndiceZero)))
  );

  return { fechamento, vencimento };
}

async function obterOuCriarFatura(
  userId: string,
  contaFinanceiraId: string,
  diaFechamento: number,
  diaVencimento: number,
  mesReferencia: string
) {
  const existente = await prisma.faturaCartao.findUnique({
    where: { contaFinanceiraId_mesReferencia: { contaFinanceiraId, mesReferencia } },
  });
  if (existente) return existente;

  const { fechamento, vencimento } = calcularFechamentoEVencimento(diaFechamento, diaVencimento, mesReferencia);
  return prisma.faturaCartao.create({
    data: {
      userId,
      contaFinanceiraId,
      mesReferencia,
      fechamento,
      vencimento,
      status: StatusLancamento.PREVISTO,
    },
  });
}

export interface DadosCompraCartao {
  descricao: string;
  valor: number;
  categoriaId: string;
  dataCompra: Date;
  fornecedorId?: string | null;
  produtoId?: string | null;
}

export async function registrarCompraNoCartao(
  userId: string,
  criadoPorId: string,
  contaFinanceiraId: string,
  dados: DadosCompraCartao
) {
  const contaFinanceira = await prisma.contaFinanceira.findFirst({
    where: { id: contaFinanceiraId, userId, tipo: TipoContaFinanceira.CARTAO_CREDITO },
  });
  if (!contaFinanceira || contaFinanceira.diaFechamento == null || contaFinanceira.diaVencimento == null) {
    throw new Error("Conta financeira não é um cartão de crédito com fechamento/vencimento configurados");
  }

  const mesReferencia = resolverMesReferenciaFatura(contaFinanceira.diaFechamento, dados.dataCompra);
  const fatura = await obterOuCriarFatura(
    userId,
    contaFinanceiraId,
    contaFinanceira.diaFechamento,
    contaFinanceira.diaVencimento,
    mesReferencia
  );

  return prisma.lancamentoFinanceiro.create({
    data: {
      userId,
      criadoPorId,
      tipo: TipoLancamento.DESPESA,
      descricao: dados.descricao,
      valor: dados.valor,
      categoriaId: dados.categoriaId,
      contaFinanceiraId,
      fornecedorId: dados.fornecedorId ?? null,
      produtoId: dados.produtoId ?? null,
      competencia: dados.dataCompra,
      vencimento: fatura.vencimento,
      status: StatusLancamento.PREVISTO,
      origem: OrigemLancamento.CARTAO,
      confianca: Confianca.CONFIRMADO,
      faturaCartaoId: fatura.id,
    },
  });
}

export async function listarFaturas(userId: string, contaFinanceiraId?: string) {
  const faturas = await prisma.faturaCartao.findMany({
    where: { userId, ...(contaFinanceiraId && { contaFinanceiraId }) },
    include: {
      contaFinanceira: { select: { nome: true } },
      lancamentos: {
        select: {
          id: true,
          descricao: true,
          valor: true,
          competencia: true,
          categoria: { select: { nome: true } },
        },
        orderBy: { competencia: "asc" },
      },
    },
    orderBy: { mesReferencia: "desc" },
  });

  return faturas.map((fatura) => ({
    ...fatura,
    total: fatura.lancamentos.reduce((soma, l) => soma + l.valor, 0),
  }));
}

async function resolverCategoriaGenerica(userId: string): Promise<string> {
  await seedPlanoContasPadrao(userId);
  const categoria = await prisma.categoriaFinanceira.findFirst({
    where: { userId, nome: "Outras", paiId: null },
    select: { id: true },
  });
  if (!categoria) {
    throw new Error('Categoria "Outras" não encontrada mesmo após o seed do plano de contas');
  }
  return categoria.id;
}

export class FaturaJaPagaError extends Error {
  constructor() {
    super("Fatura já está paga");
    this.name = "FaturaJaPagaError";
  }
}

/**
 * Gera UM lançamento de transferência (saída da conta bancária) e marca as
 * despesas da fatura como pagas — a transferência é o único evento que
 * conta no fluxo de caixa; as despesas individuais já contaram na DRE pela
 * própria competência da compra, marcá-las como pagas é só contabilidade,
 * não é um segundo movimento de caixa (ver nota em docs/AUDITORIA-CICLO-7.md
 * para a Fase 6 não somar as duas coisas).
 */
export async function pagarFatura(
  userId: string,
  faturaId: string,
  contaBancariaId: string,
  dataPagamento: Date = new Date()
): Promise<{ lancamentoPagamentoId: string }> {
  const fatura = await prisma.faturaCartao.findFirst({ where: { id: faturaId, userId } });
  if (!fatura) throw new Error("Fatura não encontrada");
  if (fatura.status === StatusLancamento.PAGO) throw new FaturaJaPagaError();

  const lancamentosDaFatura = await prisma.lancamentoFinanceiro.findMany({
    where: { faturaCartaoId: faturaId },
    select: { valor: true },
  });
  const total = lancamentosDaFatura.reduce((soma, l) => soma + l.valor, 0);
  const categoriaId = await resolverCategoriaGenerica(userId);

  const lancamentoPagamento = await prisma.lancamentoFinanceiro.create({
    data: {
      userId,
      criadoPorId: userId,
      tipo: TipoLancamento.TRANSFERENCIA,
      descricao: `Pagamento da fatura ${fatura.mesReferencia}`,
      valor: total,
      categoriaId,
      contaFinanceiraId: contaBancariaId,
      competencia: dataPagamento,
      vencimento: fatura.vencimento,
      pagamento: dataPagamento,
      status: StatusLancamento.PAGO,
      origem: OrigemLancamento.CARTAO,
      confianca: Confianca.CONFIRMADO,
      faturaCartaoId: faturaId,
    },
  });

  await prisma.$transaction([
    prisma.lancamentoFinanceiro.updateMany({
      where: { faturaCartaoId: faturaId, status: { not: StatusLancamento.PAGO } },
      data: { status: StatusLancamento.PAGO, pagamento: dataPagamento },
    }),
    prisma.faturaCartao.update({
      where: { id: faturaId },
      data: { status: StatusLancamento.PAGO, lancamentoPagamentoId: lancamentoPagamento.id },
    }),
  ]);

  return { lancamentoPagamentoId: lancamentoPagamento.id };
}
