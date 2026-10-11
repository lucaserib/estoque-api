import { describe, it, expect, vi, beforeEach } from "vitest";

interface FakePedido {
  id: number;
  userId: string;
  status: string;
  fornecedorId: string;
  dataConclusao: Date | null;
  produtos: Array<{ custo: number; quantidade: number; multiplicador: number }>;
}
interface FakeLancamento {
  id: string;
  userId: string;
  chaveExterna: string | null;
  valor: number;
  pedidoCompraId: number | null;
  parcelaNumero: number | null;
  parcelaTotal: number | null;
}

let pedidos: FakePedido[] = [];
let lancamentos: FakeLancamento[] = [];
let categorias: Array<{ id: string; userId: string; nome: string; paiId: null }> = [];
let proximoId = 1;

const seedPlanoContasPadraoMock = vi.fn();
vi.mock("../planoContasPadrao", () => ({
  seedPlanoContasPadrao: (userId: string) => seedPlanoContasPadraoMock(userId),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pedidoCompra: {
      findFirst: vi.fn(
        async ({
          where,
        }: {
          where: { id: number; userId: string; status: string };
        }) =>
          pedidos.find((p) => p.id === where.id && p.userId === where.userId && p.status === where.status) ?? null
      ),
    },
    categoriaFinanceira: {
      findFirst: vi.fn(
        async ({ where }: { where: { userId: string; nome: string } }) =>
          categorias.find((c) => c.userId === where.userId && c.nome === where.nome) ?? null
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
          create: Omit<FakeLancamento, "id">;
          update: Partial<FakeLancamento>;
        }) => {
          const chave = where.userId_chaveExterna;
          const existente = lancamentos.find(
            (l) => l.userId === chave.userId && l.chaveExterna === chave.chaveExterna
          );
          if (existente) {
            Object.assign(existente, update);
            return existente;
          }
          const novo = { id: `lanc-${proximoId++}`, ...create };
          lancamentos.push(novo);
          return novo;
        }
      ),
    },
  },
}));

const { gerarContaAPagarDePedidoCompra } = await import("../pedidoCompra");

beforeEach(() => {
  pedidos = [
    {
      id: 42,
      userId: "user-1",
      status: "confirmado",
      fornecedorId: "fornecedor-1",
      dataConclusao: new Date("2026-05-10"),
      produtos: [
        { custo: 1000, quantidade: 5, multiplicador: 2 }, // 1000*5*2=10000
        { custo: 500, quantidade: 10, multiplicador: 1 }, // 500*10*1=5000
      ],
    },
  ];
  lancamentos = [];
  categorias = [{ id: "cat-compra-mercadoria", userId: "user-1", nome: "Compra de mercadoria (estoque)", paiId: null }];
  proximoId = 1;
  seedPlanoContasPadraoMock.mockReset();
});

describe("gerarContaAPagarDePedidoCompra", () => {
  it("calcula o valor total como custo × quantidade × multiplicador somado entre os itens", async () => {
    const resultado = await gerarContaAPagarDePedidoCompra("user-1", "user-1", 42, {
      vencimento: new Date("2026-06-10"),
    });

    expect(resultado.lancamentos).toHaveLength(1);
    expect(resultado.lancamentos[0].valor).toBe(15000); // 10000 + 5000
  });

  it("rejeita pedido não confirmado ou de outra conta", async () => {
    await expect(
      gerarContaAPagarDePedidoCompra("user-1", "user-1", 999, { vencimento: new Date() })
    ).rejects.toThrow();
    await expect(
      gerarContaAPagarDePedidoCompra("outra-conta", "outra-conta", 42, { vencimento: new Date() })
    ).rejects.toThrow();
  });

  it("gerar de novo para o mesmo pedido não duplica (idempotente por chaveExterna)", async () => {
    await gerarContaAPagarDePedidoCompra("user-1", "user-1", 42, { vencimento: new Date("2026-06-10") });
    await gerarContaAPagarDePedidoCompra("user-1", "user-1", 42, { vencimento: new Date("2026-06-10") });

    expect(lancamentos).toHaveLength(1);
  });

  it("com parcelamento, gera N lançamentos ligados pelo mesmo pedido", async () => {
    const resultado = await gerarContaAPagarDePedidoCompra("user-1", "user-1", 42, {
      vencimento: new Date("2026-06-10"),
      numeroDeParcelas: 3,
    });

    expect(resultado.lancamentos).toHaveLength(3);
    expect(resultado.lancamentos.reduce((soma, l) => soma + l.valor, 0)).toBe(15000);
    expect(resultado.lancamentos.every((l) => l.pedidoCompraId === 42)).toBe(true);
  });
});
