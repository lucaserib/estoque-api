import { describe, it, expect, vi, beforeEach } from "vitest";

const enfileirarIncremental = vi.fn(async () => null);
const enfileirarPeriodo = vi.fn(async () => null);
const enfileirarCobrancas = vi.fn(async () => null);
const enfileirarTarefa = vi.fn(async () => null);
const executarFila = vi.fn(async (): Promise<Record<string, unknown>> => ({
  tarefaId: null as string | null,
  tipo: null,
  status: "CONCLUIDA",
  processados: 40,
  vendasDetalhadas: 10,
  aguardandoDetalhes: 0,
  tarefasPendentes: 0,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { mercadoLivreAccount: { findUniqueOrThrow: vi.fn(async () => ({ userId: "user-1" })) } },
}));
vi.mock("../fila", () => ({
  enfileirarIncremental: (...a: unknown[]) => enfileirarIncremental(...(a as [])),
  enfileirarPeriodo: (...a: unknown[]) => enfileirarPeriodo(...(a as [])),
  enfileirarCobrancas: (...a: unknown[]) => enfileirarCobrancas(...(a as [])),
  enfileirarTarefa: (...a: unknown[]) => enfileirarTarefa(...(a as [])),
  executarFila: (...a: unknown[]) => executarFila(...(a as [])),
}));

const { sincronizarFinanceiro } = await import("../orquestrador");

beforeEach(() => {
  for (const m of [enfileirarIncremental, enfileirarPeriodo, enfileirarCobrancas, enfileirarTarefa, executarFila]) m.mockClear();
});

describe("sincronizarFinanceiro", () => {
  it("INCREMENTAL enfileira o incremental, a fatura e ads, e processa a fila", async () => {
    const r = await sincronizarFinanceiro("conta-1", { modo: "INCREMENTAL" });
    expect(enfileirarIncremental).toHaveBeenCalledWith("conta-1", 30);
    expect(enfileirarPeriodo).not.toHaveBeenCalled();
    expect(enfileirarCobrancas).toHaveBeenCalled();
    expect(enfileirarTarefa).toHaveBeenCalledWith(expect.objectContaining({ tipo: "ADS" }));
    expect(r.status).toBe("CONCLUIDO");
    expect(r.processados).toBe(50);
  });

  it("PERIODO respeita exatamente o período pedido (borda de dia em SP) e repassa 'forcar'", async () => {
    await sincronizarFinanceiro("conta-1", {
      modo: "PERIODO",
      desde: new Date("2026-09-01T03:00:00.000Z"),
      ate: new Date("2026-10-31T23:00:00.000Z"),
      forcar: true,
    });
    const [conta, desde, ate, prioridade, forcar] = enfileirarPeriodo.mock.calls[0] as unknown as [string, Date, Date, number, boolean];
    expect(conta).toBe("conta-1");
    expect(desde.toISOString()).toBe("2026-09-01T03:00:00.000Z");
    expect(ate.toISOString()).toBe("2026-11-01T02:59:59.999Z");
    expect(prioridade).toBe(25);
    expect(forcar).toBe(true);
  });

  it("ads nunca pede mais de 31 dias, mesmo num backfill de um ano", async () => {
    await sincronizarFinanceiro("conta-1", { modo: "BACKFILL" });
    const chamada = enfileirarTarefa.mock.calls[0] as unknown as [{ desde: Date; ate: Date }];
    const dias = (chamada[0].ate.getTime() - chamada[0].desde.getTime()) / 86400000;
    expect(dias).toBeLessThanOrEqual(32);
  });

  it("fila ainda com trabalho devolve EM_ANDAMENTO com próximo passo", async () => {
    executarFila.mockResolvedValueOnce({
      tarefaId: "t1",
      tipo: null,
      status: "EM_ANDAMENTO",
      processados: 50,
      vendasDetalhadas: 0,
      aguardandoDetalhes: 100,
      tarefasPendentes: 1,
    });
    const r = await sincronizarFinanceiro("conta-1", { modo: "BACKFILL" });
    expect(r.status).toBe("EM_ANDAMENTO");
    expect(r.proximoPasso).toBe("CONTINUAR");
  });
});
