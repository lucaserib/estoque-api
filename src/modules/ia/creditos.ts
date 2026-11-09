import { Prisma, type LoteCreditoIa, type OrigemLoteCreditoIa, type RecursoIa } from "@prisma/client";
import { prisma, type ClienteTransacao } from "@/lib/prisma";

export class SemCreditosIaError extends Error {
  readonly code = "SEM_CREDITOS";

  constructor(
    readonly saldo: number,
    readonly necessario: number
  ) {
    super("As perguntas da Skubo IA da sua loja acabaram. Compre um pacote para continuar.");
    this.name = "SemCreditosIaError";
  }
}

type Cliente = ClienteTransacao;

interface LinhaLote {
  id: string;
  quantidadeRestante: number;
}

const DIA_MS = 24 * 60 * 60 * 1000;

export function validadeEmDias(dias: number, agora: Date = new Date()): Date {
  return new Date(agora.getTime() + dias * DIA_MS);
}

async function lotesValidosTravados(tx: Cliente, contaId: string, agora: Date): Promise<LinhaLote[]> {
  return tx.$queryRaw<LinhaLote[]>`
    SELECT "id", "quantidadeRestante"
    FROM "lotes_credito_ia"
    WHERE "contaId" = ${contaId} AND "validoAte" > ${agora} AND "quantidadeRestante" > 0
    ORDER BY "validoAte" ASC, "createdAt" ASC
    FOR UPDATE`;
}

async function saldoNoCliente(cliente: Cliente | typeof prisma, contaId: string, agora: Date): Promise<number> {
  const soma = await cliente.loteCreditoIa.aggregate({
    where: { contaId, validoAte: { gt: agora }, quantidadeRestante: { gt: 0 } },
    _sum: { quantidadeRestante: true },
  });
  return soma._sum.quantidadeRestante ?? 0;
}

export async function saldoCreditos(contaId: string, agora: Date = new Date()): Promise<number> {
  return saldoNoCliente(prisma, contaId, agora);
}

export interface ResumoCreditos {
  saldo: number;
  proximoVencimento: { quantidade: number; validoAte: Date } | null;
  lotes: Array<Pick<LoteCreditoIa, "id" | "origem" | "quantidadeInicial" | "quantidadeRestante" | "validoAte" | "createdAt" | "descricao">>;
}

export async function resumoCreditos(contaId: string, agora: Date = new Date()): Promise<ResumoCreditos> {
  const lotes = await prisma.loteCreditoIa.findMany({
    where: { contaId, validoAte: { gt: agora }, quantidadeRestante: { gt: 0 } },
    orderBy: [{ validoAte: "asc" }, { createdAt: "asc" }],
    select: { id: true, origem: true, quantidadeInicial: true, quantidadeRestante: true, validoAte: true, createdAt: true, descricao: true },
  });
  const saldo = lotes.reduce((total, lote) => total + lote.quantidadeRestante, 0);
  const primeiro = lotes[0];
  return {
    saldo,
    proximoVencimento: primeiro ? { quantidade: primeiro.quantidadeRestante, validoAte: primeiro.validoAte } : null,
    lotes,
  };
}

export interface PedidoLote {
  contaId: string;
  origem: OrigemLoteCreditoIa;
  quantidade: number;
  validoAte: Date;
  chaveIdempotencia: string;
  descricao: string;
  autorId?: string | null;
  compraId?: string | null;
  indicacaoId?: string | null;
}

export async function concederLote(pedido: PedidoLote, agora: Date = new Date()): Promise<{ lote: LoteCreditoIa; novo: boolean }> {
  if (!Number.isInteger(pedido.quantidade) || pedido.quantidade <= 0) throw new Error("Quantidade de perguntas inválida");
  const existente = await prisma.loteCreditoIa.findUnique({ where: { chaveIdempotencia: pedido.chaveIdempotencia } });
  if (existente) return { lote: existente, novo: false };

  try {
    const lote = await prisma.$transaction(async (tx) => {
      await lotesValidosTravados(tx, pedido.contaId, agora);
      const saldoAntes = await saldoNoCliente(tx, pedido.contaId, agora);
      const criado = await tx.loteCreditoIa.create({
        data: {
          contaId: pedido.contaId,
          origem: pedido.origem,
          quantidadeInicial: pedido.quantidade,
          quantidadeRestante: pedido.quantidade,
          validoAte: pedido.validoAte,
          chaveIdempotencia: pedido.chaveIdempotencia,
          descricao: pedido.descricao,
          compraId: pedido.compraId ?? null,
          indicacaoId: pedido.indicacaoId ?? null,
        },
      });
      await tx.movimentoCreditoIa.create({
        data: {
          contaId: pedido.contaId,
          autorId: pedido.autorId ?? null,
          loteId: criado.id,
          tipo: "ENTRADA",
          quantidade: pedido.quantidade,
          saldoApos: saldoAntes + (pedido.validoAte.getTime() > agora.getTime() ? pedido.quantidade : 0),
          descricao: pedido.descricao,
          chaveIdempotencia: `entrada:${pedido.chaveIdempotencia}`,
        },
      });
      return criado;
    });
    return { lote, novo: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const corrente = await prisma.loteCreditoIa.findUnique({ where: { chaveIdempotencia: pedido.chaveIdempotencia } });
      if (corrente) return { lote: corrente, novo: false };
    }
    throw error;
  }
}

export interface ResultadoDebito {
  debitado: number;
  saldoAntes: number;
  saldoApos: number;
  repetido: boolean;
}

export async function debitarCreditos(
  contaId: string,
  quantidade: number,
  recurso: RecursoIa,
  chave: string,
  opcoes: { autorId?: string | null; descricao?: string; usoIaId?: string | null; agora?: Date } = {}
): Promise<ResultadoDebito> {
  const agora = opcoes.agora ?? new Date();
  if (quantidade <= 0) {
    const saldo = await saldoCreditos(contaId, agora);
    return { debitado: 0, saldoAntes: saldo, saldoApos: saldo, repetido: false };
  }

  const anteriores = await prisma.movimentoCreditoIa.findMany({
    where: { contaId, tipo: "CONSUMO", chaveIdempotencia: { startsWith: `${chave}:` } },
    select: { quantidade: true, saldoApos: true },
  });
  if (anteriores.length > 0) {
    const debitado = anteriores.reduce((total, m) => total - m.quantidade, 0);
    const saldoApos = Math.min(...anteriores.map((m) => m.saldoApos));
    return { debitado, saldoAntes: saldoApos + debitado, saldoApos, repetido: true };
  }

  return prisma.$transaction(async (tx) => {
    const lotes = await lotesValidosTravados(tx, contaId, agora);
    const saldoAntes = lotes.reduce((total, lote) => total + Number(lote.quantidadeRestante), 0);
    if (saldoAntes < quantidade) throw new SemCreditosIaError(saldoAntes, quantidade);

    let falta = quantidade;
    let saldo = saldoAntes;
    for (const lote of lotes) {
      if (falta === 0) break;
      const tirar = Math.min(Number(lote.quantidadeRestante), falta);
      await tx.loteCreditoIa.update({ where: { id: lote.id }, data: { quantidadeRestante: { decrement: tirar } } });
      saldo -= tirar;
      falta -= tirar;
      await tx.movimentoCreditoIa.create({
        data: {
          contaId,
          autorId: opcoes.autorId ?? null,
          loteId: lote.id,
          tipo: "CONSUMO",
          quantidade: -tirar,
          saldoApos: saldo,
          recurso,
          usoIaId: opcoes.usoIaId ?? null,
          descricao: opcoes.descricao ?? "Pergunta à Skubo IA",
          chaveIdempotencia: `${chave}:${lote.id}`,
        },
      });
    }
    return { debitado: quantidade, saldoAntes, saldoApos: saldo, repetido: false };
  });
}

export async function estornarCreditos(chave: string, descricao = "Pergunta não respondida: devolvida", agora: Date = new Date()): Promise<number> {
  const consumos = await prisma.movimentoCreditoIa.findMany({
    where: { tipo: "CONSUMO", chaveIdempotencia: { startsWith: `${chave}:` } },
  });
  let devolvido = 0;
  for (const consumo of consumos) {
    if (!consumo.loteId) continue;
    const chaveEstorno = `estorno:${consumo.chaveIdempotencia}`;
    try {
      await prisma.$transaction(async (tx) => {
        await lotesValidosTravados(tx, consumo.contaId, agora);
        await tx.loteCreditoIa.update({ where: { id: consumo.loteId! }, data: { quantidadeRestante: { increment: -consumo.quantidade } } });
        await tx.movimentoCreditoIa.create({
          data: {
            contaId: consumo.contaId,
            autorId: consumo.autorId,
            loteId: consumo.loteId,
            tipo: "ESTORNO",
            quantidade: -consumo.quantidade,
            saldoApos: await saldoNoCliente(tx, consumo.contaId, agora),
            recurso: consumo.recurso,
            descricao,
            chaveIdempotencia: chaveEstorno,
          },
        });
      });
      devolvido += -consumo.quantidade;
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
    }
  }
  return devolvido;
}

export async function removerRestanteDoLote(
  loteId: string,
  descricao: string,
  chaveIdempotencia: string,
  agora: Date = new Date()
): Promise<number> {
  const lote = await prisma.loteCreditoIa.findUnique({ where: { id: loteId } });
  if (!lote || lote.quantidadeRestante <= 0) return 0;
  try {
    return await prisma.$transaction(async (tx) => {
      await lotesValidosTravados(tx, lote.contaId, agora);
      const atual = await tx.loteCreditoIa.findUniqueOrThrow({ where: { id: loteId } });
      if (atual.quantidadeRestante <= 0) return 0;
      await tx.loteCreditoIa.update({ where: { id: loteId }, data: { quantidadeRestante: 0 } });
      await tx.movimentoCreditoIa.create({
        data: {
          contaId: lote.contaId,
          loteId,
          tipo: "AJUSTE",
          quantidade: -atual.quantidadeRestante,
          saldoApos: await saldoNoCliente(tx, lote.contaId, agora),
          descricao,
          chaveIdempotencia,
        },
      });
      return atual.quantidadeRestante;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return 0;
    throw error;
  }
}

export async function expirarLotesVencidos(agora: Date = new Date(), limite = 500): Promise<{ lotes: number; perguntas: number }> {
  const vencidos = await prisma.loteCreditoIa.findMany({
    where: { validoAte: { lte: agora }, quantidadeRestante: { gt: 0 } },
    orderBy: { validoAte: "asc" },
    take: limite,
    select: { id: true, origem: true },
  });
  let lotes = 0;
  let perguntas = 0;
  for (const vencido of vencidos) {
    const lote = await prisma.loteCreditoIa.findUnique({ where: { id: vencido.id } });
    if (!lote || lote.quantidadeRestante <= 0) continue;
    try {
      await prisma.$transaction(async (tx) => {
        const { count } = await tx.loteCreditoIa.updateMany({
          where: { id: lote.id, quantidadeRestante: lote.quantidadeRestante },
          data: { quantidadeRestante: 0 },
        });
        if (count === 0) return;
        await tx.movimentoCreditoIa.create({
          data: {
            contaId: lote.contaId,
            loteId: lote.id,
            tipo: "EXPIRACAO",
            quantidade: -lote.quantidadeRestante,
            saldoApos: await saldoNoCliente(tx, lote.contaId, agora),
            descricao: "Perguntas vencidas",
            chaveIdempotencia: `expiracao:${lote.id}`,
          },
        });
      });
      lotes++;
      perguntas += lote.quantidadeRestante;
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
    }
  }
  return { lotes, perguntas };
}

export async function extratoCreditos(contaId: string, pagina = 1, porPagina = 20) {
  const [total, itens] = await Promise.all([
    prisma.movimentoCreditoIa.count({ where: { contaId } }),
    prisma.movimentoCreditoIa.findMany({
      where: { contaId },
      orderBy: { createdAt: "desc" },
      skip: (Math.max(1, pagina) - 1) * porPagina,
      take: porPagina,
      select: { id: true, tipo: true, quantidade: true, saldoApos: true, recurso: true, descricao: true, createdAt: true },
    }),
  ]);
  return { total, pagina: Math.max(1, pagina), porPagina, itens };
}
