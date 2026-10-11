import { describe, it, expect, vi, beforeEach } from "vitest";

interface FakeLancamento {
  id: string;
  grupoParcelamentoId: string;
  parcelaNumero: number;
  parcelaTotal: number;
  valor: number;
  vencimento: Date;
}

let lancamentos: FakeLancamento[] = [];
let proximoId = 1;

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lancamentoFinanceiro: {
      create: vi.fn(async ({ data }: { data: Omit<FakeLancamento, "id"> }) => {
        const novo = { id: `id-${proximoId++}`, ...data };
        lancamentos.push(novo);
        return novo;
      }),
    },
  },
}));

const { criarCompraParcelada } = await import("../parcelamento");

beforeEach(() => {
  lancamentos = [];
  proximoId = 1;
});

describe("criarCompraParcelada", () => {
  it("gera N lançamentos ligados pelo mesmo grupoParcelamentoId", async () => {
    const resultado = await criarCompraParcelada("user-1", "user-1", {
      descricao: "Equipamento",
      valorTotal: 90000,
      categoriaId: "cat-1",
      competencia: new Date("2026-05-01"),
      primeiroVencimento: new Date("2026-05-10"),
      numeroDeParcelas: 3,
    });

    expect(resultado.lancamentos).toHaveLength(3);
    expect(new Set(resultado.lancamentos.map((l) => l.grupoParcelamentoId)).size).toBe(1);
  });

  it("rateia os centavos na última parcela, não distribuído", async () => {
    const resultado = await criarCompraParcelada("user-1", "user-1", {
      descricao: "Equipamento",
      valorTotal: 100000,
      categoriaId: "cat-1",
      competencia: new Date("2026-05-01"),
      primeiroVencimento: new Date("2026-05-10"),
      numeroDeParcelas: 3,
    });

    const valores = resultado.lancamentos.map((l) => l.valor);
    expect(valores).toEqual([33333, 33333, 33334]);
    expect(valores.reduce((a, b) => a + b, 0)).toBe(100000);
  });

  it("cada parcela vence um mês depois da anterior, preservando o dia", async () => {
    const resultado = await criarCompraParcelada("user-1", "user-1", {
      descricao: "Equipamento",
      valorTotal: 30000,
      categoriaId: "cat-1",
      competencia: new Date("2026-01-01"),
      primeiroVencimento: new Date("2026-01-31"),
      numeroDeParcelas: 3,
    });

    const vencimentos = resultado.lancamentos.map((l) => l.vencimento.toISOString().slice(0, 10));
    expect(vencimentos).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });

  it("numera as parcelas corretamente", async () => {
    const resultado = await criarCompraParcelada("user-1", "user-1", {
      descricao: "Equipamento",
      valorTotal: 30000,
      categoriaId: "cat-1",
      competencia: new Date("2026-01-01"),
      primeiroVencimento: new Date("2026-01-10"),
      numeroDeParcelas: 3,
    });

    expect(resultado.lancamentos.map((l) => `${l.parcelaNumero}/${l.parcelaTotal}`)).toEqual([
      "1/3", "2/3", "3/3",
    ]);
  });
});
