import {
  Confianca,
  OrigemLancamento,
  StatusLancamento,
  TipoLancamento,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { invalidarCacheFinanceiro } from "../relatorios/cache";

export interface DadosLancamento {
  tipo: TipoLancamento;
  descricao: string;
  valor: number;
  categoriaId: string;
  contaFinanceiraId?: string | null;
  competencia: Date;
  vencimento: Date;
  pagamento?: Date | null;
  fornecedorId?: string | null;
  produtoId?: string | null;
  anexoUrl?: string | null;
  observacao?: string | null;
}

export async function criarLancamento(
  userId: string,
  criadoPorId: string,
  dados: DadosLancamento
) {
  const lancamento = await prisma.lancamentoFinanceiro.create({
    data: {
      userId,
      criadoPorId,
      tipo: dados.tipo,
      descricao: dados.descricao,
      valor: dados.valor,
      categoriaId: dados.categoriaId,
      contaFinanceiraId: dados.contaFinanceiraId ?? null,
      competencia: dados.competencia,
      vencimento: dados.vencimento,
      pagamento: dados.pagamento ?? null,
      status: dados.pagamento ? StatusLancamento.PAGO : StatusLancamento.PREVISTO,
      origem: OrigemLancamento.MANUAL,
      confianca: Confianca.CONFIRMADO,
      fornecedorId: dados.fornecedorId ?? null,
      produtoId: dados.produtoId ?? null,
      anexoUrl: dados.anexoUrl ?? null,
      observacao: dados.observacao ?? null,
    },
  });
  await invalidarCacheFinanceiro(userId);
  return lancamento;
}

export interface FiltrosLancamento {
  desde?: Date;
  ate?: Date;
  status?: StatusLancamento;
  categoriaId?: string;
  contaFinanceiraId?: string;
  fornecedorId?: string;
  origem?: OrigemLancamento;
  tipo?: TipoLancamento;
}

export async function listarLancamentos(userId: string, filtros: FiltrosLancamento) {
  return prisma.lancamentoFinanceiro.findMany({
    where: {
      userId,
      ...(filtros.status && { status: filtros.status }),
      ...(filtros.categoriaId && { categoriaId: filtros.categoriaId }),
      ...(filtros.contaFinanceiraId && { contaFinanceiraId: filtros.contaFinanceiraId }),
      ...(filtros.fornecedorId && { fornecedorId: filtros.fornecedorId }),
      ...(filtros.origem && { origem: filtros.origem }),
      ...(filtros.tipo && { tipo: filtros.tipo }),
      ...((filtros.desde || filtros.ate) && {
        vencimento: {
          ...(filtros.desde && { gte: filtros.desde }),
          ...(filtros.ate && { lte: filtros.ate }),
        },
      }),
    },
    include: { categoria: true, contaFinanceira: true, fornecedor: true },
    orderBy: { vencimento: "asc" },
  });
}

export class LancamentoNaoEncontradoError extends Error {
  constructor() {
    super("Lançamento não encontrado");
    this.name = "LancamentoNaoEncontradoError";
  }
}

async function exigirLancamentoDaConta(userId: string, id: string): Promise<void> {
  const existente = await prisma.lancamentoFinanceiro.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!existente) throw new LancamentoNaoEncontradoError();
}

export async function atualizarLancamento(
  userId: string,
  id: string,
  dados: Partial<DadosLancamento> & { status?: StatusLancamento }
) {
  await exigirLancamentoDaConta(userId, id);
  const lancamento = await prisma.lancamentoFinanceiro.update({ where: { id }, data: dados });
  await invalidarCacheFinanceiro(userId);
  return lancamento;
}

export async function excluirLancamento(userId: string, id: string): Promise<void> {
  await exigirLancamentoDaConta(userId, id);
  await prisma.lancamentoFinanceiro.delete({ where: { id } });
  await invalidarCacheFinanceiro(userId);
}

export async function marcarComoPagoEmLote(
  userId: string,
  ids: string[],
  dataPagamento: Date = new Date()
): Promise<{ atualizados: number }> {
  const resultado = await prisma.lancamentoFinanceiro.updateMany({
    where: { id: { in: ids }, userId },
    data: { status: StatusLancamento.PAGO, pagamento: dataPagamento },
  });
  await invalidarCacheFinanceiro(userId);
  return { atualizados: resultado.count };
}

export async function alterarCategoriaEmLote(
  userId: string,
  ids: string[],
  categoriaId: string
): Promise<{ atualizados: number }> {
  const resultado = await prisma.lancamentoFinanceiro.updateMany({
    where: { id: { in: ids }, userId },
    data: { categoriaId },
  });
  await invalidarCacheFinanceiro(userId);
  return { atualizados: resultado.count };
}

/** Só previstos — excluir um lançamento já pago em lote seria fácil demais de apertar por engano. */
export async function excluirPrevistosEmLote(
  userId: string,
  ids: string[]
): Promise<{ excluidos: number }> {
  const resultado = await prisma.lancamentoFinanceiro.deleteMany({
    where: { id: { in: ids }, userId, status: StatusLancamento.PREVISTO },
  });
  await invalidarCacheFinanceiro(userId);
  return { excluidos: resultado.count };
}
