import { TipoContaFinanceira } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function listarContasFinanceiras(userId: string, incluirInativas = false) {
  return prisma.contaFinanceira.findMany({
    where: { userId, ...(incluirInativas ? {} : { ativo: true }) },
    orderBy: { nome: "asc" },
  });
}

export interface DadosContaFinanceira {
  nome: string;
  tipo: TipoContaFinanceira;
  saldoInicial: number;
  dataSaldoInicial: Date;
  diaFechamento?: number | null;
  diaVencimento?: number | null;
  limite?: number | null;
}

export async function criarContaFinanceira(userId: string, dados: DadosContaFinanceira) {
  return prisma.contaFinanceira.create({
    data: {
      userId,
      nome: dados.nome,
      tipo: dados.tipo,
      saldoInicial: dados.saldoInicial,
      dataSaldoInicial: dados.dataSaldoInicial,
      diaFechamento: dados.diaFechamento ?? null,
      diaVencimento: dados.diaVencimento ?? null,
      limite: dados.limite ?? null,
    },
  });
}

export class ContaFinanceiraNaoEncontradaError extends Error {
  constructor() {
    super("Conta financeira não encontrada");
    this.name = "ContaFinanceiraNaoEncontradaError";
  }
}

export async function atualizarContaFinanceira(
  userId: string,
  id: string,
  dados: Partial<DadosContaFinanceira> & { ativo?: boolean }
) {
  const conta = await prisma.contaFinanceira.findFirst({ where: { id, userId } });
  if (!conta) throw new ContaFinanceiraNaoEncontradaError();
  return prisma.contaFinanceira.update({ where: { id }, data: dados });
}
