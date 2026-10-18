import { describe, it, expect, vi, beforeEach } from "vitest";
import { CanalVenda } from "@prisma/client";

interface FakeVenda {
  userId: string;
  canal: CanalVenda;
  contaCanalId: string;
  pedidoExternoId: string;
  dataLiberacao: Date;
  statusLiberacao: string | null;
  valorLiquidoReceber: number | null;
  retencaoDividas: number;
}

let vendas: FakeVenda[] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vendaCanal: {
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: {
            userId: string;
            canal: CanalVenda;
            contaCanalId: string;
            dataLiberacao: { gte: Date; lte: Date };
            statusLiberacao: string;
          };
        }) =>
          vendas.filter(
            (v) =>
              v.userId === where.userId &&
              v.canal === where.canal &&
              v.contaCanalId === where.contaCanalId &&
              v.statusLiberacao === where.statusLiberacao &&
              v.dataLiberacao >= where.dataLiberacao.gte &&
              v.dataLiberacao <= where.dataLiberacao.lte
          )
      ),
    },
  },
}));

interface LiberacaoFake {
  referenciaExterna: string | null;
  valor: number;
  data: Date;
}
const conferirLiberacoesMock = vi.fn(async (..._args: unknown[]): Promise<{ habilitado: boolean; liberacoes: LiberacaoFake[] }> => ({
  habilitado: false,
  liberacoes: [],
}));
vi.mock("../liberacoes", () => ({
  conferirLiberacoes: (...args: unknown[]) => conferirLiberacoesMock(...args),
}));

const { listarMovimentosCarteira } = await import("../movimentosCarteira");

beforeEach(() => {
  vendas = [];
  conferirLiberacoesMock.mockClear();
  conferirLiberacoesMock.mockResolvedValue({ habilitado: false, liberacoes: [] });
});

describe("listarMovimentosCarteira", () => {
  it("lista liberações e retenções de vendas já liberadas (released) no período", async () => {
    vendas.push({
      userId: "user-1", canal: CanalVenda.MERCADO_LIVRE, contaCanalId: "conta-1",
      pedidoExternoId: "P1", dataLiberacao: new Date("2026-05-10"), statusLiberacao: "released",
      valorLiquidoReceber: 1272, retencaoDividas: 1214,
    });

    const resultado = await listarMovimentosCarteira(
      "user-1", "conta-1", new Date("2026-05-01"), new Date("2026-05-31")
    );

    expect(resultado.totalLiberacoes).toBe(1272);
    expect(resultado.totalRetencoes).toBe(-1214);
    expect(resultado.liquidoPeriodoVendas).toBe(1272 - 1214);
    expect(resultado.movimentos).toHaveLength(2);
  });

  it("venda sem retenção não gera movimento RETENCAO", async () => {
    vendas.push({
      userId: "user-1", canal: CanalVenda.MERCADO_LIVRE, contaCanalId: "conta-1",
      pedidoExternoId: "P2", dataLiberacao: new Date("2026-05-10"), statusLiberacao: "released",
      valorLiquidoReceber: 5000, retencaoDividas: 0,
    });

    const resultado = await listarMovimentosCarteira(
      "user-1", "conta-1", new Date("2026-05-01"), new Date("2026-05-31")
    );

    expect(resultado.movimentos).toHaveLength(1);
    expect(resultado.movimentos[0].tipo).toBe("LIBERACAO");
  });

  it("relatório MP desligado: relatorioMpHabilitado false e totalRelatorioMp zero, sem afetar liquidoPeriodoVendas", async () => {
    vendas.push({
      userId: "user-1", canal: CanalVenda.MERCADO_LIVRE, contaCanalId: "conta-1",
      pedidoExternoId: "P3", dataLiberacao: new Date("2026-05-10"), statusLiberacao: "released",
      valorLiquidoReceber: 1000, retencaoDividas: 0,
    });

    const resultado = await listarMovimentosCarteira(
      "user-1", "conta-1", new Date("2026-05-01"), new Date("2026-05-31")
    );

    expect(resultado.relatorioMpHabilitado).toBe(false);
    expect(resultado.totalRelatorioMp).toBe(0);
    expect(resultado.liquidoPeriodoVendas).toBe(1000);
  });

  it("relatório MP ligado: soma em totalRelatorioMp, separado de liquidoPeriodoVendas (evita contar duas vezes)", async () => {
    conferirLiberacoesMock.mockResolvedValue({
      habilitado: true,
      liberacoes: [{ referenciaExterna: "X", valor: 3000, data: new Date("2026-05-15") }],
    });
    vendas.push({
      userId: "user-1", canal: CanalVenda.MERCADO_LIVRE, contaCanalId: "conta-1",
      pedidoExternoId: "P4", dataLiberacao: new Date("2026-05-10"), statusLiberacao: "released",
      valorLiquidoReceber: 1000, retencaoDividas: 0,
    });

    const resultado = await listarMovimentosCarteira(
      "user-1", "conta-1", new Date("2026-05-01"), new Date("2026-05-31")
    );

    expect(resultado.totalRelatorioMp).toBe(3000);
    expect(resultado.liquidoPeriodoVendas).toBe(1000);
    expect(resultado.movimentos).toHaveLength(2);
  });

  it("venda com statusLiberacao pending (ainda não liberada) não entra", async () => {
    vendas.push({
      userId: "user-1", canal: CanalVenda.MERCADO_LIVRE, contaCanalId: "conta-1",
      pedidoExternoId: "P5", dataLiberacao: new Date("2026-05-10"), statusLiberacao: "pending",
      valorLiquidoReceber: 1000, retencaoDividas: 0,
    });

    const resultado = await listarMovimentosCarteira(
      "user-1", "conta-1", new Date("2026-05-01"), new Date("2026-05-31")
    );

    expect(resultado.movimentos).toHaveLength(0);
  });
});
