import { describe, it, expect, vi, beforeEach } from "vitest";

const getValidTokenMock = vi.fn(async () => "token-falso");
vi.mock("@/services/mercadoLivreService", () => ({
  MercadoLivreService: { getValidToken: getValidTokenMock },
}));

let contas: Array<{ id: string; userId: string; nickname: string; mlUserId: string }> = [];
let contasFinanceiras: Array<{
  id: string;
  userId: string;
  contaCanalId: string | null;
  nome: string;
  tipo: string;
  saldoAtualExterno: number | null;
  saldoALiberarExterno: number | null;
  saldoExternoAtualizadoEm: Date | null;
  saldoExternoConfianca: string | null;
}> = [];
let proximoId = 1;

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mercadoLivreAccount: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        contas.find((c) => c.id === where.id) ?? null
      ),
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
        const conta = contas.find((c) => c.id === where.id);
        if (!conta) throw new Error("conta não encontrada");
        return conta;
      }),
    },
    contaFinanceira: {
      findUnique: vi.fn(
        async ({ where }: { where: { userId_contaCanalId: { userId: string; contaCanalId: string } } }) =>
          contasFinanceiras.find(
            (c) =>
              c.userId === where.userId_contaCanalId.userId &&
              c.contaCanalId === where.userId_contaCanalId.contaCanalId
          ) ?? null
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const nova = { id: `conta-fin-${proximoId++}`, saldoAtualExterno: null, saldoALiberarExterno: null, saldoExternoAtualizadoEm: null, saldoExternoConfianca: null, ...data } as never;
        contasFinanceiras.push(nova);
        return nova;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const conta = contasFinanceiras.find((c) => c.id === where.id);
        if (!conta) throw new Error("conta financeira não encontrada");
        Object.assign(conta, data);
        return conta;
      }),
    },
  },
}));

const { obterSaldoMercadoPago, sincronizarSaldoMercadoPago } = await import("../saldo");

beforeEach(() => {
  contas = [{ id: "conta-1", userId: "user-1", nickname: "LEAPSTORE", mlUserId: "999" }];
  contasFinanceiras = [];
  proximoId = 1;
  getValidTokenMock.mockClear();
  vi.unstubAllGlobals();
});

describe("obterSaldoMercadoPago", () => {
  it("mapeia available_balance/unavailable_balance para centavos com confianca CONFIRMADO", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ available_balance: 123.45, unavailable_balance: 50 }), { status: 200 })
      )
    );

    const saldo = await obterSaldoMercadoPago("999", "token");

    expect(saldo).toEqual({ disponivel: 12345, aLiberar: 5000, confianca: "CONFIRMADO" });
  });

  it("resposta não ok devolve nulos com confianca ESTIMADO, sem inventar valor", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("erro", { status: 404 })));

    const saldo = await obterSaldoMercadoPago("999", "token");

    expect(saldo).toEqual({ disponivel: null, aLiberar: null, confianca: "ESTIMADO" });
  });

  it("erro de rede não derruba a chamada", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("timeout"); }));

    const saldo = await obterSaldoMercadoPago("999", "token");

    expect(saldo).toEqual({ disponivel: null, aLiberar: null, confianca: "ESTIMADO" });
  });
});

describe("sincronizarSaldoMercadoPago", () => {
  it("cria a conta financeira automática na primeira sincronização e grava o saldo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ available_balance: 10, unavailable_balance: 0 }), { status: 200 }))
    );

    await sincronizarSaldoMercadoPago("conta-1");

    expect(contasFinanceiras).toHaveLength(1);
    expect(contasFinanceiras[0].nome).toBe("Mercado Pago — LEAPSTORE");
    expect(contasFinanceiras[0].saldoAtualExterno).toBe(1000);
    expect(contasFinanceiras[0].saldoExternoConfianca).toBe("CONFIRMADO");
  });

  it("reaproveita a conta financeira já existente em sincronizações seguintes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ available_balance: 10, unavailable_balance: 0 }), { status: 200 }))
    );
    await sincronizarSaldoMercadoPago("conta-1");
    await sincronizarSaldoMercadoPago("conta-1");

    expect(contasFinanceiras).toHaveLength(1);
  });
});
