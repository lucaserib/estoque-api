import { describe, it, expect, vi, beforeEach } from "vitest";
import { CanalVenda } from "@prisma/client";

interface FakeResumo {
  userId: string;
  dia: Date;
  canal: CanalVenda;
  pedidos: number;
  unidades: number;
  faturamentoBruto: number;
  cancelamentos: number;
  descontos: number;
  tarifas: number;
  frete: number;
  ads: number;
  impostos: number;
  cmv: number;
  margemContribuicao: number;
}
interface FakeLancamento {
  userId: string;
  tipo: string;
  status: string;
  valor: number;
  vencimento: Date;
  competencia: Date;
  categoriaGrupoDre: string;
}
interface FakeVenda {
  userId: string;
  dataLiberacao: Date | null;
  valorLiquidoReceber: number | null;
}

let resumos: FakeResumo[] = [];
let lancamentos: FakeLancamento[] = [];
let vendas: FakeVenda[] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    resumoFinanceiroDiario: {
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: { userId: string; dia: { gte: Date; lte: Date }; canal?: CanalVenda };
        }) =>
          resumos.filter(
            (r) =>
              r.userId === where.userId &&
              r.dia.getTime() >= where.dia.gte.getTime() &&
              r.dia.getTime() <= where.dia.lte.getTime() &&
              (!where.canal || r.canal === where.canal)
          )
      ),
    },
    lancamentoFinanceiro: {
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: {
            userId: string;
            tipo?: string;
            status?: string;
            vencimento?: { gte?: Date; lte?: Date; lt?: Date };
            competencia?: { gte: Date; lte: Date };
            categoria?: { grupoDre: string };
          };
        }) =>
          lancamentos.filter((l) => {
            if (l.userId !== where.userId) return false;
            if (where.tipo && l.tipo !== where.tipo) return false;
            if (where.status && l.status !== where.status) return false;
            if (where.vencimento?.gte && l.vencimento.getTime() < where.vencimento.gte.getTime()) return false;
            if (where.vencimento?.lte && l.vencimento.getTime() > where.vencimento.lte.getTime()) return false;
            if (where.vencimento?.lt && l.vencimento.getTime() >= where.vencimento.lt.getTime()) return false;
            if (where.competencia && (l.competencia < where.competencia.gte || l.competencia > where.competencia.lte)) return false;
            if (where.categoria && l.categoriaGrupoDre !== where.categoria.grupoDre) return false;
            return true;
          })
      ),
    },
    vendaCanal: {
      findMany: vi.fn(
        async ({ where }: { where: { userId: string; dataLiberacao: { gte: Date; lte: Date } } }) =>
          vendas.filter(
            (v) =>
              v.userId === where.userId &&
              v.dataLiberacao &&
              v.dataLiberacao.getTime() >= where.dataLiberacao.gte.getTime() &&
              v.dataLiberacao.getTime() <= where.dataLiberacao.lte.getTime()
          )
      ),
    },
  },
}));

vi.mock("@/lib/cache", () => ({
  withUserCache: vi.fn(async (_userId: string, _key: string, fetcher: () => Promise<unknown>) => fetcher()),
  mlCache: { invalidatePattern: vi.fn(async () => 0) },
}));

const { gerarResumoDia } = await import("../resumoDia");

const HOJE = new Date("2026-05-15T15:00:00.000Z"); // 12h em SP, bem dentro do dia 15

function resumo(parcial: Partial<FakeResumo> & { dia: Date }): FakeResumo {
  return {
    userId: "user-1", canal: CanalVenda.MERCADO_LIVRE,
    pedidos: 0, unidades: 0, faturamentoBruto: 0, cancelamentos: 0, descontos: 0,
    tarifas: 0, frete: 0, ads: 0, impostos: 0, cmv: 0, margemContribuicao: 0,
    ...parcial,
  };
}

beforeEach(() => {
  resumos = [];
  lancamentos = [];
  vendas = [];
});

describe("gerarResumoDia", () => {
  it("traz os totais do dia direto do ResumoFinanceiroDiario", async () => {
    resumos.push(resumo({ dia: new Date("2026-05-15T03:00:00.000Z"), pedidos: 10, faturamentoBruto: 50000, margemContribuicao: 15000 }));

    const resultadoResumo = await gerarResumoDia("user-1", HOJE);

    expect(resultadoResumo.pedidos).toBe(10);
    expect(resultadoResumo.faturamentoBruto).toBe(50000);
  });

  it("ticket médio é faturamento dividido por pedidos; null sem pedidos", async () => {
    resumos.push(resumo({ dia: new Date("2026-05-15T03:00:00.000Z"), pedidos: 4, faturamentoBruto: 40000 }));
    const comPedidos = await gerarResumoDia("user-1", HOJE);
    expect(comPedidos.ticketMedio).toBe(10000);

    resumos = [];
    const semPedidos = await gerarResumoDia("user-1", HOJE);
    expect(semPedidos.ticketMedio).toBeNull();
  });

  it("lucro estimado é a margem de contribuição menos a despesa fixa diária (mensal ÷ dias do mês)", async () => {
    resumos.push(resumo({ dia: new Date("2026-05-15T03:00:00.000Z"), margemContribuicao: 10000 }));
    // maio tem 31 dias; despesa fixa de 31000 no mês → 1000/dia
    lancamentos.push({
      userId: "user-1", tipo: "DESPESA", status: "PAGO", valor: 31000,
      vencimento: new Date("2026-05-10"), competencia: new Date("2026-05-01T12:00:00.000Z"),
      categoriaGrupoDre: "DESPESA_OPERACIONAL",
    });

    const resultadoResumo = await gerarResumoDia("user-1", HOJE);

    expect(resultadoResumo.lucroEstimado).toBe(10000 - 1000);
  });

  it("compara com ontem e com a média dos últimos 7 dias", async () => {
    resumos.push(resumo({ dia: new Date("2026-05-15T03:00:00.000Z"), faturamentoBruto: 20000 }));
    // últimos 7 dias (incluindo ontem, dia 1 atrás), todos com o mesmo valor —
    // assim "ontem" e "média dos últimos 7 dias" dão o mesmo número de
    // referência, sem precisar de uma entrada duplicada e conflitante pro dia de ontem.
    for (let diasAtras = 1; diasAtras <= 7; diasAtras++) {
      const dia = new Date(HOJE.getTime() - diasAtras * 24 * 60 * 60 * 1000);
      resumos.push(resumo({ dia: new Date(`${dia.toISOString().slice(0, 10)}T03:00:00.000Z`), faturamentoBruto: 7000 }));
    }

    const resultadoResumo = await gerarResumoDia("user-1", HOJE);

    expect(resultadoResumo.comparacaoOntem.faturamentoBruto.valorComparado).toBe(7000);
    expect(resultadoResumo.comparacaoOntem.faturamentoBruto.percentual).toBeCloseTo((20000 - 7000) / 7000, 5);
    expect(resultadoResumo.comparacaoMedia7Dias.faturamentoBruto.valorComparado).toBe(7000);
  });

  it("separa contas a pagar vencendo hoje das vencidas", async () => {
    lancamentos.push(
      { userId: "user-1", tipo: "DESPESA", status: "PREVISTO", valor: 500, vencimento: new Date("2026-05-15T03:00:00.000Z"), competencia: new Date("2026-05-01"), categoriaGrupoDre: "DESPESA_OPERACIONAL" },
      { userId: "user-1", tipo: "DESPESA", status: "PREVISTO", valor: 300, vencimento: new Date("2026-05-10T03:00:00.000Z"), competencia: new Date("2026-05-01"), categoriaGrupoDre: "DESPESA_OPERACIONAL" },
      { userId: "user-1", tipo: "DESPESA", status: "PAGO", valor: 999, vencimento: new Date("2026-05-10T03:00:00.000Z"), competencia: new Date("2026-05-01"), categoriaGrupoDre: "DESPESA_OPERACIONAL" }
    );

    const resultadoResumo = await gerarResumoDia("user-1", HOJE);

    expect(resultadoResumo.contasAPagar.vencendoHoje).toEqual({ quantidade: 1, valor: 500 });
    expect(resultadoResumo.contasAPagar.vencidas).toEqual({ quantidade: 1, valor: 300 });
  });

  it("soma o valor líquido a receber das vendas liberadas no dia", async () => {
    vendas.push(
      { userId: "user-1", dataLiberacao: new Date("2026-05-15T10:00:00.000Z"), valorLiquidoReceber: 8000 },
      { userId: "user-1", dataLiberacao: new Date("2026-05-15T20:00:00.000Z"), valorLiquidoReceber: 2000 },
      { userId: "user-1", dataLiberacao: new Date("2026-05-16T10:00:00.000Z"), valorLiquidoReceber: 5000 }
    );

    const resultadoResumo = await gerarResumoDia("user-1", HOJE);

    expect(resultadoResumo.valorALiberarMercadoPago).toBe(10000);
  });
});
