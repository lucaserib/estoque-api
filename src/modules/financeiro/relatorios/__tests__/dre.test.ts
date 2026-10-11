import { describe, it, expect, vi, beforeEach } from "vitest";
import { CanalVenda } from "@prisma/client";

interface FakeResumo {
  userId: string;
  dia: Date;
  canal: CanalVenda;
  faturamentoBruto: number;
  cancelamentos: number;
  descontos: number;
  impostos: number;
  tarifas: number;
  frete: number;
  ads: number;
  cmv: number;
  margemContribuicao: number;
}
interface FakeLancamento {
  userId: string;
  tipo: string;
  valor: number;
  categoriaId: string;
  categoriaNome: string;
  categoriaGrupoDre: string;
  competencia: Date;
}
interface FakeCobranca {
  userId: string;
  canal: CanalVenda;
  mesReferencia: string;
  tipoNormalizado: string;
  coberturaPedido: boolean;
  valor: number;
}

let resumos: FakeResumo[] = [];
let lancamentos: FakeLancamento[] = [];
let cobrancas: FakeCobranca[] = [];
let regimeTributario = "SIMPLES";
let chamadasFindManyResumo = 0;

vi.mock("@/lib/prisma", () => ({
  prisma: {
    configuracaoGeral: {
      findUnique: vi.fn(async () => ({ regimeTributario })),
    },
    resumoFinanceiroDiario: {
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: { userId: string; dia: { gte: Date; lte: Date }; canal?: CanalVenda };
        }) => {
          chamadasFindManyResumo++;
          return resumos.filter(
            (r) =>
              r.userId === where.userId &&
              r.dia.getTime() >= where.dia.gte.getTime() &&
              r.dia.getTime() <= where.dia.lte.getTime() &&
              (!where.canal || r.canal === where.canal)
          );
        }
      ),
    },
    vendaCanal: {
      findMany: vi.fn(async () => []),
      aggregate: vi.fn(async () => ({ _sum: { outrosCustos: 0 } })),
    },
    cobrancaCanal: {
      aggregate: vi.fn(
        async ({
          where,
        }: {
          where: { userId: string; mesReferencia: string; tipoNormalizado: string; coberturaPedido: boolean; canal?: CanalVenda };
        }) => {
          const soma = cobrancas
            .filter(
              (c) =>
                c.userId === where.userId &&
                c.mesReferencia === where.mesReferencia &&
                c.tipoNormalizado === where.tipoNormalizado &&
                c.coberturaPedido === where.coberturaPedido &&
                (!where.canal || c.canal === where.canal)
            )
            .reduce((soma, c) => soma + c.valor, 0);
          return { _sum: { valor: soma } };
        }
      ),
    },
    lancamentoFinanceiro: {
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: { userId: string; competencia: { gte: Date; lte: Date }; categoria: { grupoDre: string } };
        }) =>
          lancamentos
            .filter(
              (l) =>
                l.userId === where.userId &&
                l.competencia.getTime() >= where.competencia.gte.getTime() &&
                l.competencia.getTime() <= where.competencia.lte.getTime() &&
                l.categoriaGrupoDre === where.categoria.grupoDre
            )
            .map((l) => ({
              tipo: l.tipo,
              valor: l.valor,
              categoriaId: l.categoriaId,
              categoria: { nome: l.categoriaNome },
            }))
      ),
    },
  },
}));

vi.mock("@/lib/cache", () => ({
  withUserCache: vi.fn(async (_userId: string, _key: string, fetcher: () => Promise<unknown>) => fetcher()),
  mlCache: { invalidatePattern: vi.fn(async () => 0) },
}));

const { gerarDre } = await import("../dre");

function resumo(parcial: Partial<FakeResumo> = {}): FakeResumo {
  return {
    userId: "user-1",
    dia: new Date("2026-05-10T03:00:00.000Z"),
    canal: CanalVenda.MERCADO_LIVRE,
    faturamentoBruto: 0,
    cancelamentos: 0,
    descontos: 0,
    impostos: 0,
    tarifas: 0,
    frete: 0,
    ads: 0,
    cmv: 0,
    margemContribuicao: 0,
    ...parcial,
  };
}

beforeEach(() => {
  resumos = [];
  lancamentos = [];
  cobrancas = [];
  regimeTributario = "SIMPLES";
  chamadasFindManyResumo = 0;
});

describe("gerarDre", () => {
  it("monta a estrutura básica da DRE a partir do ResumoFinanceiroDiario", async () => {
    resumos.push(
      resumo({
        faturamentoBruto: 100000, cancelamentos: 5000, descontos: 2000, impostos: 3000,
        tarifas: 10000, frete: 5000, ads: 1000, cmv: 40000, margemContribuicao: 39000,
      })
    );

    const relatorio = await gerarDre("user-1", { ano: 2026, mes: 5 }, 1);
    const mes = relatorio.meses[0];

    expect(mes.faturamentoBruto).toBe(100000);
    expect(mes.receitaOperacionalBruta).toBe(100000 - 5000 - 2000);
    expect(mes.receitaLiquida).toBe(100000 - 5000 - 2000 - 3000);
    expect(mes.custosVariaveis.tarifas).toBe(10000);
    expect(mes.cmv).toBe(40000);
  });

  it("regime SIMPLES nunca cobra imposto sobre o lucro, mesmo com lançamento na categoria", async () => {
    regimeTributario = "SIMPLES";
    lancamentos.push({
      userId: "user-1", tipo: "DESPESA", valor: 5000, categoriaId: "cat-ir",
      categoriaNome: "IR/CSLL", categoriaGrupoDre: "IMPOSTO_LUCRO", competencia: new Date("2026-05-10"),
    });

    const relatorio = await gerarDre("user-1", { ano: 2026, mes: 5 }, 1);

    expect(relatorio.meses[0].impostoLucro).toBe(0);
  });

  it("regime PRESUMIDO soma o IR/CSLL lançado", async () => {
    regimeTributario = "PRESUMIDO";
    lancamentos.push({
      userId: "user-1", tipo: "DESPESA", valor: 5000, categoriaId: "cat-ir",
      categoriaNome: "IR/CSLL", categoriaGrupoDre: "IMPOSTO_LUCRO", competencia: new Date("2026-05-10"),
    });

    const relatorio = await gerarDre("user-1", { ano: 2026, mes: 5 }, 1);

    expect(relatorio.meses[0].impostoLucro).toBe(5000);
  });

  it("agrupa despesas operacionais por categoria", async () => {
    lancamentos.push(
      { userId: "user-1", tipo: "DESPESA", valor: 3000, categoriaId: "cat-pessoal", categoriaNome: "Pessoal", categoriaGrupoDre: "DESPESA_OPERACIONAL", competencia: new Date("2026-05-05") },
      { userId: "user-1", tipo: "DESPESA", valor: 2000, categoriaId: "cat-pessoal", categoriaNome: "Pessoal", categoriaGrupoDre: "DESPESA_OPERACIONAL", competencia: new Date("2026-05-20") },
      { userId: "user-1", tipo: "DESPESA", valor: 1000, categoriaId: "cat-software", categoriaNome: "Software e assinaturas", categoriaGrupoDre: "DESPESA_OPERACIONAL", competencia: new Date("2026-05-10") }
    );

    const relatorio = await gerarDre("user-1", { ano: 2026, mes: 5 }, 1);
    const despesas = relatorio.meses[0].despesasOperacionais;

    expect(despesas.find((d) => d.categoriaId === "cat-pessoal")?.valor).toBe(5000);
    expect(despesas.find((d) => d.categoriaId === "cat-software")?.valor).toBe(1000);
    expect(relatorio.meses[0].totalDespesasOperacionais).toBe(6000);
  });

  it("percentuais ficam null quando a receita líquida é zero (não divide por zero)", async () => {
    const relatorio = await gerarDre("user-1", { ano: 2026, mes: 5 }, 1);

    expect(relatorio.meses[0].margemContribuicaoPercentual).toBeNull();
    expect(relatorio.meses[0].lucroLiquidoPercentual).toBeNull();
  });

  it("devolve os meses do mais antigo para o mais recente", async () => {
    const relatorio = await gerarDre("user-1", { ano: 2026, mes: 5 }, 3);

    expect(relatorio.meses.map((m) => m.competencia)).toEqual([
      { ano: 2026, mes: 3 }, { ano: 2026, mes: 4 }, { ano: 2026, mes: 5 },
    ]);
  });

  it("virada de ano no comparativo de meses", async () => {
    const relatorio = await gerarDre("user-1", { ano: 2026, mes: 1 }, 2);

    expect(relatorio.meses.map((m) => m.competencia)).toEqual([
      { ano: 2025, mes: 12 }, { ano: 2026, mes: 1 },
    ]);
  });

  it("filtro por canal restringe a consulta ao ResumoFinanceiroDiario", async () => {
    resumos.push(resumo({ canal: CanalVenda.MERCADO_LIVRE, faturamentoBruto: 1000 }));

    const relatorio = await gerarDre("user-1", { ano: 2026, mes: 5 }, 1, { canal: CanalVenda.MERCADO_LIVRE });

    expect(relatorio.meses[0].faturamentoBruto).toBe(1000);
  });

  it("armazenagem Full vem das cobranças, não do resumo diário", async () => {
    cobrancas.push({
      userId: "user-1", canal: CanalVenda.MERCADO_LIVRE, mesReferencia: "2026-05",
      tipoNormalizado: "ARMAZENAGEM_FULL", coberturaPedido: false, valor: 7000,
    });

    const relatorio = await gerarDre("user-1", { ano: 2026, mes: 5 }, 1);

    expect(relatorio.meses[0].custosVariaveis.armazenagemFull).toBe(7000);
  });
});
