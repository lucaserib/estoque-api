import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  usoIa: { count: vi.fn(async () => 0) },
  loteCreditoIa: { findFirst: vi.fn(async () => ({ id: "lote-9" })) },
  user: { findMany: vi.fn(async () => [{ id: "dono", email: "dono@loja.com" }, { id: "membro", email: "m@loja.com" }]) },
  notification: { create: vi.fn(async () => ({})) },
}));
const creditos = vi.hoisted(() => ({ debitarCreditos: vi.fn() }));
const automacoes = vi.hoisted(() => ({ dispararAutomacao: vi.fn(async () => null) }));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("../creditos", () => creditos);
vi.mock("@/modules/email/automacoes", () => automacoes);
vi.mock("@/modules/clientes/eventos", () => ({ registrarEvento: vi.fn() }));
vi.mock("@/modules/comercial/configuracao", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/modules/comercial/configuracao")>();
  return { ...original, obterConfiguracaoComercial: vi.fn(async () => original.CONFIGURACAO_PADRAO) };
});

import { cobrarUsoIa, custoDoRecurso } from "../consumo";

beforeEach(() => {
  vi.clearAllMocks();
  creditos.debitarCreditos.mockResolvedValue({ debitado: 1, saldoAntes: 10, saldoApos: 9, repetido: false });
});

describe("custo por recurso", () => {
  it("chat e análise custam o peso configurado", async () => {
    expect(await custoDoRecurso("CHAT", "c1")).toBe(1);
    expect(await custoDoRecurso("ANALISE_CONTROLE", "c1")).toBe(1);
    expect(await custoDoRecurso("RESUMO_SEMANAL", "c1")).toBe(0);
  });

  it("explicação é grátis até o limite do dia e depois custa 1", async () => {
    prismaMock.usoIa.count.mockResolvedValueOnce(19);
    expect(await custoDoRecurso("EXPLICACAO", "c1")).toBe(0);
    prismaMock.usoIa.count.mockResolvedValueOnce(20);
    expect(await custoDoRecurso("EXPLICACAO", "c1")).toBe(1);
  });
});

describe("cobrarUsoIa", () => {
  it("liberação manual ou env não debita", async () => {
    const r = await cobrarUsoIa({ contaId: "c1", autorId: "u1", recurso: "CHAT", chave: "chat:1", ilimitada: true });
    expect(r.debitado).toBe(0);
    expect(creditos.debitarCreditos).not.toHaveBeenCalled();
  });

  it("ao cruzar 3 perguntas, avisa quem perguntou e o dono uma vez por recarga", async () => {
    creditos.debitarCreditos.mockResolvedValue({ debitado: 1, saldoAntes: 4, saldoApos: 3, repetido: false });
    await cobrarUsoIa({ contaId: "dono", autorId: "membro", recurso: "CHAT", chave: "chat:2", ilimitada: false });
    expect(automacoes.dispararAutomacao).toHaveBeenCalledTimes(2);
    expect(automacoes.dispararAutomacao).toHaveBeenCalledWith(
      expect.objectContaining({ chave: "creditos-acabando", chaveIdempotencia: "creditos-acabando:dono:lote-9:membro", variaveis: { saldo_ia: 3 } })
    );
  });

  it("ao zerar, manda o aviso de esgotado", async () => {
    creditos.debitarCreditos.mockResolvedValue({ debitado: 1, saldoAntes: 1, saldoApos: 0, repetido: false });
    await cobrarUsoIa({ contaId: "dono", autorId: "dono", recurso: "CHAT", chave: "chat:3", ilimitada: false });
    expect(automacoes.dispararAutomacao).toHaveBeenCalledWith(expect.objectContaining({ chave: "creditos-esgotados" }));
  });

  it("acima do limiar não avisa", async () => {
    await cobrarUsoIa({ contaId: "dono", autorId: "dono", recurso: "CHAT", chave: "chat:4", ilimitada: false });
    expect(automacoes.dispararAutomacao).not.toHaveBeenCalled();
  });
});
