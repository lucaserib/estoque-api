import { describe, it, expect, vi, beforeEach } from "vitest";

interface LinhaAgrupada {
  tipoExterno: string;
  userId: string;
  canal: string;
  mesReferencia: string;
  tipoNormalizado: string;
  quantidade: number;
  valor: number;
}

let linhas: LinhaAgrupada[] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    cobrancaCanal: {
      groupBy: vi.fn(
        async ({
          where,
        }: {
          where: { userId: string; canal: string; tipoNormalizado: string; mesReferencia?: string };
        }) =>
          linhas
            .filter(
              (l) =>
                l.userId === where.userId &&
                l.canal === where.canal &&
                l.tipoNormalizado === where.tipoNormalizado &&
                (!where.mesReferencia || l.mesReferencia === where.mesReferencia)
            )
            .map((l) => ({
              tipoExterno: l.tipoExterno,
              _count: { _all: l.quantidade },
              _sum: { valor: l.valor },
            }))
      ),
    },
  },
}));

const { listarCobrancasNaoMapeadas } = await import("../cobrancasNaoMapeadas");

beforeEach(() => {
  linhas = [];
});

describe("listarCobrancasNaoMapeadas", () => {
  it("ordena do maior para o menor total", async () => {
    linhas = [
      { tipoExterno: "shipping_bonus", userId: "user-1", canal: "MERCADO_LIVRE", mesReferencia: "2026-05", tipoNormalizado: "NAO_MAPEADO", quantidade: 2, valor: 500 },
      { tipoExterno: "ads_penalty", userId: "user-1", canal: "MERCADO_LIVRE", mesReferencia: "2026-05", tipoNormalizado: "NAO_MAPEADO", quantidade: 10, valor: 9000 },
    ];

    const resultado = await listarCobrancasNaoMapeadas("user-1", "2026-05");

    expect(resultado.map((r) => r.tipoExterno)).toEqual(["ads_penalty", "shipping_bonus"]);
    expect(resultado[0]).toEqual({ tipoExterno: "ads_penalty", quantidade: 10, total: 9000 });
  });

  it("ignora linhas de outro usuário ou já mapeadas", async () => {
    linhas = [
      { tipoExterno: "x", userId: "outro-user", canal: "MERCADO_LIVRE", mesReferencia: "2026-05", tipoNormalizado: "NAO_MAPEADO", quantidade: 1, valor: 100 },
      { tipoExterno: "y", userId: "user-1", canal: "MERCADO_LIVRE", mesReferencia: "2026-05", tipoNormalizado: "TARIFA_VENDA", quantidade: 1, valor: 200 },
    ];

    const resultado = await listarCobrancasNaoMapeadas("user-1", "2026-05");

    expect(resultado).toEqual([]);
  });

  it("sem mesReferencia, não filtra por mês", async () => {
    linhas = [
      { tipoExterno: "x", userId: "user-1", canal: "MERCADO_LIVRE", mesReferencia: "2026-04", tipoNormalizado: "NAO_MAPEADO", quantidade: 1, valor: 100 },
      { tipoExterno: "x", userId: "user-1", canal: "MERCADO_LIVRE", mesReferencia: "2026-05", tipoNormalizado: "NAO_MAPEADO", quantidade: 1, valor: 100 },
    ];

    const resultado = await listarCobrancasNaoMapeadas("user-1");

    expect(resultado).toHaveLength(2);
  });
});
