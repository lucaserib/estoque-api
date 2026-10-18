import { Confianca, StatusLancamento, TipoContaFinanceira } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { valorComoCaixa } from "./fluxoCaixa";

export type OrigemSaldo = "API_MERCADO_PAGO" | "LANCAMENTOS";

export interface ContaComSaldo {
  id: string;
  nome: string;
  tipo: TipoContaFinanceira;
  saldoInicial: number;
  saldoAtual: number;
  saldoALiberarExterno: number | null;
  saldoExternoAtualizadoEm: Date | null;
  origemSaldo: OrigemSaldo;
  ativo: boolean;
  automatica: boolean;
}

export async function listarContasComSaldo(userId: string): Promise<ContaComSaldo[]> {
  const contas = await prisma.contaFinanceira.findMany({
    where: { userId, ativo: true },
    orderBy: { nome: "asc" },
  });

  const agora = new Date();

  return Promise.all(
    contas.map(async (conta): Promise<ContaComSaldo> => {
      if (
        conta.tipo === TipoContaFinanceira.CARTEIRA_MARKETPLACE &&
        conta.saldoExternoConfianca === Confianca.CONFIRMADO &&
        conta.saldoAtualExterno != null
      ) {
        return {
          id: conta.id,
          nome: conta.nome,
          tipo: conta.tipo,
          saldoInicial: conta.saldoInicial,
          saldoAtual: conta.saldoAtualExterno,
          saldoALiberarExterno: conta.saldoALiberarExterno,
          saldoExternoAtualizadoEm: conta.saldoExternoAtualizadoEm,
          origemSaldo: "API_MERCADO_PAGO",
          ativo: conta.ativo,
          automatica: conta.automatica,
        };
      }

      const lancamentos = await prisma.lancamentoFinanceiro.findMany({
        where: {
          contaFinanceiraId: conta.id,
          status: StatusLancamento.PAGO,
          pagamento: { gte: conta.dataSaldoInicial, lte: agora },
        },
        select: { tipo: true, valor: true },
      });
      const movimentado = lancamentos.reduce((soma, l) => soma + valorComoCaixa(l.tipo, l.valor), 0);

      return {
        id: conta.id,
        nome: conta.nome,
        tipo: conta.tipo,
        saldoInicial: conta.saldoInicial,
        saldoAtual: conta.saldoInicial + movimentado,
        saldoALiberarExterno: conta.saldoALiberarExterno,
        saldoExternoAtualizadoEm: conta.saldoExternoAtualizadoEm,
        origemSaldo: "LANCAMENTOS",
        ativo: conta.ativo,
        automatica: conta.automatica,
      };
    })
  );
}

export async function calcularSaldoTotalAtual(userId: string): Promise<number> {
  const contas = await listarContasComSaldo(userId);
  return contas
    .filter((c) => c.tipo !== TipoContaFinanceira.CARTAO_CREDITO)
    .reduce((soma, c) => soma + c.saldoAtual, 0);
}
