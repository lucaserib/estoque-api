import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const URL_BANCO = process.env.TESTE_BANCO_URL;

vi.unmock("@/lib/prisma");

describe.skipIf(!URL_BANCO)("créditos de IA no Postgres", () => {
  let creditos: typeof import("../creditos");
  let prisma: typeof import("@/lib/prisma").prisma;
  const contaId = `teste-creditos-${Date.now()}`;
  const DIA = 24 * 60 * 60 * 1000;

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_BANCO;
    vi.resetModules();
    creditos = await import("../creditos");
    prisma = (await import("@/lib/prisma")).prisma;
  });

  beforeEach(async () => {
    await prisma.movimentoCreditoIa.deleteMany({ where: { contaId } });
    await prisma.loteCreditoIa.deleteMany({ where: { contaId } });
  });

  afterAll(async () => {
    await prisma.movimentoCreditoIa.deleteMany({ where: { contaId } });
    await prisma.loteCreditoIa.deleteMany({ where: { contaId } });
    await prisma.$disconnect();
  });

  function lote(quantidade: number, validoEmDias: number, chave: string) {
    return creditos.concederLote({
      contaId,
      origem: "COMPRA",
      quantidade,
      validoAte: new Date(Date.now() + validoEmDias * DIA),
      chaveIdempotencia: `${contaId}:${chave}`,
      descricao: chave,
    });
  }

  it("duas perguntas ao mesmo tempo com saldo 1: só uma passa", async () => {
    await lote(1, 30, "unico");
    const resultados = await Promise.allSettled([
      creditos.debitarCreditos(contaId, 1, "CHAT", `${contaId}:p1`),
      creditos.debitarCreditos(contaId, 1, "CHAT", `${contaId}:p2`),
    ]);
    const ok = resultados.filter((r) => r.status === "fulfilled");
    const recusadas = resultados.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(recusadas).toHaveLength(1);
    expect(recusadas[0].reason).toBeInstanceOf(creditos.SemCreditosIaError);
    expect(await creditos.saldoCreditos(contaId)).toBe(0);
  });

  it("consome primeiro o lote que vence antes e grava o extrato por lote", async () => {
    const curto = await lote(2, 5, "curto");
    const longo = await lote(5, 60, "longo");
    const resultado = await creditos.debitarCreditos(contaId, 3, "CHAT", `${contaId}:fifo`);
    expect(resultado).toMatchObject({ debitado: 3, saldoAntes: 7, saldoApos: 4 });
    const [a, b] = await Promise.all([
      prisma.loteCreditoIa.findUniqueOrThrow({ where: { id: curto.lote.id } }),
      prisma.loteCreditoIa.findUniqueOrThrow({ where: { id: longo.lote.id } }),
    ]);
    expect(a.quantidadeRestante).toBe(0);
    expect(b.quantidadeRestante).toBe(4);
    const consumos = await prisma.movimentoCreditoIa.findMany({ where: { contaId, tipo: "CONSUMO" }, orderBy: { saldoApos: "desc" } });
    expect(consumos.map((m) => [m.quantidade, m.saldoApos])).toEqual([
      [-2, 5],
      [-1, 4],
    ]);
  });

  it("a mesma chave não debita duas vezes e o estorno devolve exatamente o que saiu", async () => {
    await lote(2, 5, "a");
    await lote(5, 60, "b");
    await creditos.debitarCreditos(contaId, 3, "CHAT", `${contaId}:repetida`);
    const repetido = await creditos.debitarCreditos(contaId, 3, "CHAT", `${contaId}:repetida`);
    expect(repetido).toMatchObject({ repetido: true, debitado: 3 });
    expect(await creditos.saldoCreditos(contaId)).toBe(4);

    expect(await creditos.estornarCreditos(`${contaId}:repetida`)).toBe(3);
    expect(await creditos.estornarCreditos(`${contaId}:repetida`)).toBe(0);
    expect(await creditos.saldoCreditos(contaId)).toBe(7);
  });

  it("lote vencido expira uma vez só e sai do saldo", async () => {
    await prisma.loteCreditoIa.create({
      data: {
        contaId,
        origem: "TESTE",
        quantidadeInicial: 5,
        quantidadeRestante: 3,
        validoAte: new Date(Date.now() - DIA),
        chaveIdempotencia: `${contaId}:vencido`,
      },
    });
    await lote(2, 30, "vigente");
    expect(await creditos.saldoCreditos(contaId)).toBe(2);
    const primeira = await creditos.expirarLotesVencidos();
    expect(primeira.perguntas).toBeGreaterThanOrEqual(3);
    const expiracao = await prisma.movimentoCreditoIa.findFirstOrThrow({ where: { contaId, tipo: "EXPIRACAO" } });
    expect(expiracao).toMatchObject({ quantidade: -3, saldoApos: 2 });
    await creditos.expirarLotesVencidos();
    expect(await prisma.movimentoCreditoIa.count({ where: { contaId, tipo: "EXPIRACAO" } })).toBe(1);
  });

  it("conceder o mesmo lote duas vezes não duplica", async () => {
    const primeiro = await lote(25, 365, "compra-x");
    const segundo = await lote(25, 365, "compra-x");
    expect(primeiro.novo).toBe(true);
    expect(segundo.novo).toBe(false);
    expect(await creditos.saldoCreditos(contaId)).toBe(25);
  });
});
