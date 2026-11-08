import { CanalVenda, StatusLancamento, StatusVendaCanal, TipoContaFinanceira } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { garantirContaFinanceiraMercadoPago } from "../lancamentos/contasFinanceiras";
import { valorComoCaixa } from "./fluxoCaixa";

export type OrigemSaldo = "API_MERCADO_PAGO" | "LIBERACOES_E_LANCAMENTOS" | "LANCAMENTOS";

export interface ContaComSaldo {
  id: string;
  nome: string;
  tipo: TipoContaFinanceira;
  saldoInicial: number;
  dataSaldoInicial: Date;
  saldoAtual: number;
  saldoALiberar: number | null;
  liberadoDesdeAjuste: number | null;
  movimentadoDesdeAjuste: number;
  saldoAtualizadoEm: Date | null;
  origemSaldo: OrigemSaldo;
  precisaAjuste: boolean;
  ativo: boolean;
  automatica: boolean;
  contaCanalId: string | null;
}

const STATUS_SEM_LIBERACAO = [StatusVendaCanal.CANCELADA, StatusVendaCanal.DEVOLVIDA];

export async function garantirCarteirasMercadoPago(userId: string): Promise<void> {
  const contasMl = await prisma.mercadoLivreAccount.findMany({
    where: { userId, isActive: true },
    select: { id: true, nickname: true },
  });
  for (const conta of contasMl) {
    await garantirContaFinanceiraMercadoPago(userId, conta.id, conta.nickname ?? "Mercado Livre");
  }
}

async function somarLiquidoDeVendas(
  contaCanalId: string,
  depoisDe: Date,
  ateInclusive: Date | null
): Promise<number> {
  const resultado = await prisma.vendaCanal.aggregate({
    where: {
      canal: CanalVenda.MERCADO_LIVRE,
      contaCanalId,
      status: { notIn: STATUS_SEM_LIBERACAO },
      dataLiberacao: ateInclusive ? { gt: depoisDe, lte: ateInclusive } : { gt: depoisDe },
    },
    _sum: { valorLiquidoReceber: true },
  });
  return resultado._sum.valorLiquidoReceber ?? 0;
}

export async function listarContasComSaldo(userId: string): Promise<ContaComSaldo[]> {
  await garantirCarteirasMercadoPago(userId);

  const contas = await prisma.contaFinanceira.findMany({
    where: { userId, ativo: true },
    orderBy: [{ automatica: "desc" }, { nome: "asc" }],
  });
  const agora = new Date();

  return Promise.all(
    contas.map(async (conta): Promise<ContaComSaldo> => {
      const lancamentos = await prisma.lancamentoFinanceiro.findMany({
        where: {
          contaFinanceiraId: conta.id,
          status: StatusLancamento.PAGO,
          pagamento: { gt: conta.dataSaldoInicial, lte: agora },
        },
        select: { tipo: true, valor: true },
      });
      const movimentado = lancamentos.reduce((soma, l) => soma + valorComoCaixa(l.tipo, l.valor), 0);

      const ehCarteiraMl = conta.tipo === TipoContaFinanceira.CARTEIRA_MARKETPLACE && conta.contaCanalId != null;
      if (ehCarteiraMl) {
        const contaCanalId = conta.contaCanalId as string;
        const [liberado, aLiberar] = await Promise.all([
          somarLiquidoDeVendas(contaCanalId, conta.dataSaldoInicial, agora),
          somarLiquidoDeVendas(contaCanalId, agora, null),
        ]);
        return {
          id: conta.id,
          nome: conta.nome,
          tipo: conta.tipo,
          saldoInicial: conta.saldoInicial,
          dataSaldoInicial: conta.dataSaldoInicial,
          saldoAtual: conta.saldoInicial + liberado + movimentado,
          saldoALiberar: aLiberar,
          liberadoDesdeAjuste: liberado,
          movimentadoDesdeAjuste: movimentado,
          saldoAtualizadoEm: agora,
          origemSaldo: "LIBERACOES_E_LANCAMENTOS",
          precisaAjuste: conta.saldoInicial === 0 && conta.updatedAt.getTime() === conta.createdAt.getTime(),
          ativo: conta.ativo,
          automatica: conta.automatica,
          contaCanalId: conta.contaCanalId,
        };
      }

      return {
        id: conta.id,
        nome: conta.nome,
        tipo: conta.tipo,
        saldoInicial: conta.saldoInicial,
        dataSaldoInicial: conta.dataSaldoInicial,
        saldoAtual: conta.saldoInicial + movimentado,
        saldoALiberar: null,
        liberadoDesdeAjuste: null,
        movimentadoDesdeAjuste: movimentado,
        saldoAtualizadoEm: agora,
        origemSaldo: "LANCAMENTOS",
        precisaAjuste: false,
        ativo: conta.ativo,
        automatica: conta.automatica,
        contaCanalId: conta.contaCanalId,
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

export class ContaParaAjusteNaoEncontradaError extends Error {
  constructor() {
    super("Conta financeira não encontrada");
    this.name = "ContaParaAjusteNaoEncontradaError";
  }
}

export async function ajustarSaldoConta(userId: string, contaId: string, saldoAtual: number): Promise<void> {
  const conta = await prisma.contaFinanceira.findFirst({ where: { id: contaId, userId } });
  if (!conta) throw new ContaParaAjusteNaoEncontradaError();
  await prisma.contaFinanceira.update({
    where: { id: contaId },
    data: { saldoInicial: saldoAtual, dataSaldoInicial: new Date() },
  });
}
