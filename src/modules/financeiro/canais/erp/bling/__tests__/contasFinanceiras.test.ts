import { describe, it, expect, vi, beforeEach } from "vitest";

let configuracoes: Array<{ userId: string; blingContasAtivo: boolean }> = [];
let categorias: Array<{ id: string; userId: string; nome: string; paiId: string | null }> = [];
let mapeamentos: Array<{ blingCategoriaId: string; categoriaFinanceiraId: string }> = [];
let fornecedores: Array<{ id: string; userId: string; blingContatoId: string | null }> = [];
let lancamentos: Array<{ userId: string; chaveExterna: string } & Record<string, unknown>> = [];
let proximoId = 1;

vi.mock("@/lib/prisma", () => ({
  prisma: {
    configuracaoGeral: {
      findUnique: vi.fn(async ({ where }: { where: { userId: string } }) =>
        configuracoes.find((c) => c.userId === where.userId) ?? null
      ),
    },
    categoriaFinanceira: {
      findFirst: vi.fn(async ({ where }: { where: { userId: string; nome: string; paiId: null } }) =>
        categorias.find((c) => c.userId === where.userId && c.nome === where.nome) ?? null
      ),
      findMany: vi.fn(async () => []),
      createMany: vi.fn(async () => ({ count: 0 })),
    },
    mapeamentoCategoriaBling: {
      findMany: vi.fn(async () => mapeamentos),
    },
    fornecedor: {
      findFirst: vi.fn(async ({ where }: { where: { userId: string; blingContatoId: string } }) =>
        fornecedores.find((f) => f.userId === where.userId && f.blingContatoId === where.blingContatoId) ?? null
      ),
    },
    lancamentoFinanceiro: {
      upsert: vi.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: { userId_chaveExterna: { userId: string; chaveExterna: string } };
          create: Record<string, unknown>;
          update: Record<string, unknown>;
        }) => {
          const chave = where.userId_chaveExterna;
          const existente = lancamentos.find(
            (l) => l.userId === chave.userId && l.chaveExterna === chave.chaveExterna
          );
          if (existente) {
            Object.assign(existente, update);
            return existente;
          }
          const novo = { id: `lanc-${proximoId++}`, ...create } as unknown as typeof lancamentos[number];
          lancamentos.push(novo);
          return novo;
        }
      ),
    },
  },
}));

const getContasPagarMock = vi.fn();
const getContasReceberMock = vi.fn();
vi.mock("@/services/blingService", () => ({
  BlingService: {
    getContasPagar: (...args: unknown[]) => getContasPagarMock(...args),
    getContasReceber: (...args: unknown[]) => getContasReceberMock(...args),
  },
}));

const { sincronizarContasFinanceirasBling, ingerirContasAPagarBling } = await import("../contasFinanceiras");

beforeEach(() => {
  configuracoes = [{ userId: "user-1", blingContasAtivo: true }];
  categorias = [{ id: "cat-outras", userId: "user-1", nome: "Outras", paiId: null }];
  mapeamentos = [];
  fornecedores = [];
  lancamentos = [];
  proximoId = 1;
  getContasPagarMock.mockReset();
  getContasReceberMock.mockReset();
});

describe("sincronizarContasFinanceirasBling", () => {
  it("flag desligada: não chama a API do Bling", async () => {
    configuracoes[0].blingContasAtivo = false;

    const resultado = await sincronizarContasFinanceirasBling("user-1", "bling-1");

    expect(resultado.pagar.processadas).toBe(0);
    expect(getContasPagarMock).not.toHaveBeenCalled();
  });

  it("cria um LancamentoFinanceiro DESPESA por conta a pagar, categoria 'Outras' sem mapeamento", async () => {
    getContasPagarMock.mockResolvedValueOnce([
      { id: 1, vencimento: "2026-06-10", valor: 150.5, situacao: 1, numeroDocumento: "NF-1" },
    ]).mockResolvedValueOnce([]);
    getContasReceberMock.mockResolvedValueOnce([]);

    const resultado = await sincronizarContasFinanceirasBling("user-1", "bling-1");

    expect(resultado.pagar.processadas).toBe(1);
    expect(lancamentos).toHaveLength(1);
    expect(lancamentos[0].valor).toBe(15050);
    expect(lancamentos[0].categoriaId).toBe("cat-outras");
    expect(lancamentos[0].tipo).toBe("DESPESA");
    expect(lancamentos[0].origem).toBe("ERP");
    expect(lancamentos[0].chaveExterna).toBe("bling:pagar:1");
  });

  it("usa o mapeamento de categoria quando existe", async () => {
    mapeamentos = [{ blingCategoriaId: "77", categoriaFinanceiraId: "cat-tarifas" }];
    getContasPagarMock.mockResolvedValueOnce([
      { id: 2, vencimento: "2026-06-10", valor: 10, situacao: 1, categoria: { id: 77 } },
    ]).mockResolvedValueOnce([]);

    await ingerirContasAPagarBling("user-1", "bling-1");

    expect(lancamentos[0].categoriaId).toBe("cat-tarifas");
  });

  it("casa o fornecedor por blingContatoId e marca PAGO quando há dataPagamento", async () => {
    fornecedores = [{ id: "forn-1", userId: "user-1", blingContatoId: "55" }];
    getContasPagarMock.mockResolvedValueOnce([
      { id: 3, vencimento: "2026-06-10", valor: 20, situacao: 2, dataPagamento: "2026-06-05", contato: { id: 55 } },
    ]).mockResolvedValueOnce([]);

    await ingerirContasAPagarBling("user-1", "bling-1");

    expect(lancamentos[0].fornecedorId).toBe("forn-1");
    expect(lancamentos[0].status).toBe("PAGO");
  });

  it("é idempotente: a mesma conta não duplica, upsert atualiza o lançamento existente", async () => {
    getContasPagarMock
      .mockResolvedValueOnce([{ id: 1, vencimento: "2026-06-10", valor: 10, situacao: 1 }])
      .mockResolvedValueOnce([{ id: 1, vencimento: "2026-06-10", valor: 20, situacao: 1 }]);

    await ingerirContasAPagarBling("user-1", "bling-1");
    await ingerirContasAPagarBling("user-1", "bling-1");

    expect(lancamentos).toHaveLength(1);
    expect(lancamentos[0].valor).toBe(2000);
  });

  it("pagina até a API devolver menos resultados que o limite da página", async () => {
    const paginaCheia = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, vencimento: "2026-06-10", valor: 1, situacao: 1 }));
    getContasPagarMock
      .mockResolvedValueOnce(paginaCheia)
      .mockResolvedValueOnce([{ id: 101, vencimento: "2026-06-10", valor: 1, situacao: 1 }]);

    const resultado = await ingerirContasAPagarBling("user-1", "bling-1");

    expect(resultado.processadas).toBe(101);
    expect(getContasPagarMock).toHaveBeenCalledTimes(2);
  });
});
