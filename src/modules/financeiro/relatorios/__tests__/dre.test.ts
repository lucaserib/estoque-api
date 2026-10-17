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
    vendaCanalItem: {
      aggregate: vi.fn(async () => ({ _sum: { descontoCusteadoMl: 0 } })),
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
    expect(mes.receitaOperacionalBruta).toBe(100000 - 5000);
    expect(mes.receitaLiquida).toBe(100000 - 5000 - 3000);
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

  it("F7 (Ciclo 8): com contaCanalId, faturamento inclui a venda cancelada e a receita não é descontada em dobro", async () => {
    const prismaMock = (await import("@/lib/prisma")).prisma as unknown as {
      vendaCanal: { findMany: ReturnType<typeof vi.fn> };
    };
    prismaMock.vendaCanal.findMany.mockResolvedValueOnce([
      {
        faturamentoBruto: 10000, status: "PAGA", descontoVendedor: 0, impostoEstimado: 0,
        tarifaVenda: 0, freteVendedor: 0, adsAtribuido: 0, cmv: 0, margemContribuicao: 10000,
      },
      {
        faturamentoBruto: 5000, status: "CANCELADA", descontoVendedor: 0, impostoEstimado: 0,
        tarifaVenda: 0, freteVendedor: 0, adsAtribuido: 0, cmv: 0, margemContribuicao: 0,
      },
    ]);

    const relatorio = await gerarDre("user-1", { ano: 2026, mes: 5 }, 1, {
      canal: CanalVenda.MERCADO_LIVRE,
      contaCanalId: "conta-1",
    });
    const mes = relatorio.meses[0];

    expect(mes.faturamentoBruto).toBe(15000);
    expect(mes.cancelamentosEDevolucoes).toBe(5000);
    expect(mes.receitaOperacionalBruta).toBe(10000);
  });

  it("mês sintético completo: cada linha da DRE confere com o cálculo manual", async () => {
    regimeTributario = "PRESUMIDO";

    resumos.push(
      resumo({
        dia: new Date("2026-05-05T03:00:00.000Z"),
        faturamentoBruto: 200000, cancelamentos: 10000, descontos: 5000, impostos: 8000,
        tarifas: 15000, frete: 7000, ads: 3000, cmv: 60000,
      }),
      resumo({
        dia: new Date("2026-05-20T03:00:00.000Z"),
        faturamentoBruto: 150000, cancelamentos: 0, descontos: 3000, impostos: 5000,
        tarifas: 10000, frete: 4000, ads: 2000, cmv: 30000,
      })
    );

    cobrancas.push(
      { userId: "user-1", canal: CanalVenda.MERCADO_LIVRE, mesReferencia: "2026-05", tipoNormalizado: "ARMAZENAGEM_FULL", coberturaPedido: false, valor: 4000 },
      { userId: "user-1", canal: CanalVenda.MERCADO_LIVRE, mesReferencia: "2026-05", tipoNormalizado: "NAO_MAPEADO", coberturaPedido: false, valor: 1500 }
    );

    const prismaMock = (await import("@/lib/prisma")).prisma as unknown as {
      vendaCanal: { aggregate: ReturnType<typeof vi.fn> };
    };
    prismaMock.vendaCanal.aggregate.mockResolvedValueOnce({ _sum: { outrosCustos: 500 } });

    lancamentos.push(
      { userId: "user-1", tipo: "DESPESA", valor: 8000, categoriaId: "cat-pessoal", categoriaNome: "Pessoal", categoriaGrupoDre: "DESPESA_OPERACIONAL", competencia: new Date("2026-05-05") },
      { userId: "user-1", tipo: "DESPESA", valor: 4000, categoriaId: "cat-pessoal", categoriaNome: "Pessoal", categoriaGrupoDre: "DESPESA_OPERACIONAL", competencia: new Date("2026-05-20") },
      { userId: "user-1", tipo: "DESPESA", valor: 2500, categoriaId: "cat-software", categoriaNome: "Software e assinaturas", categoriaGrupoDre: "DESPESA_OPERACIONAL", competencia: new Date("2026-05-10") },
      { userId: "user-1", tipo: "RECEITA", valor: 1000, categoriaId: "cat-rendimentos", categoriaNome: "Rendimentos", categoriaGrupoDre: "RESULTADO_FINANCEIRO", competencia: new Date("2026-05-15") },
      { userId: "user-1", tipo: "DESPESA", valor: 300, categoriaId: "cat-juros", categoriaNome: "Juros e tarifas financeiras", categoriaGrupoDre: "RESULTADO_FINANCEIRO", competencia: new Date("2026-05-15") },
      { userId: "user-1", tipo: "DESPESA", valor: 6000, categoriaId: "cat-ir", categoriaNome: "IR/CSLL", categoriaGrupoDre: "IMPOSTO_LUCRO", competencia: new Date("2026-05-28") }
    );

    const relatorio = await gerarDre("user-1", { ano: 2026, mes: 5 }, 1);
    const mes = relatorio.meses[0];

    // Faturamento e receita
    expect(mes.faturamentoBruto).toBe(350000);
    expect(mes.cancelamentosEDevolucoes).toBe(10000);
    expect(mes.descontos).toBe(8000);
    expect(mes.receitaOperacionalBruta).toBe(340000); // 350000 - 10000
    expect(mes.impostosSobreVendas).toBe(13000);
    expect(mes.receitaLiquida).toBe(327000); // 340000 - 13000

    // Custos variáveis
    expect(mes.custosVariaveis).toEqual({
      tarifas: 25000,
      frete: 11000,
      publicidade: 5000,
      armazenagemFull: 4000,
      outrasTarifasNaoMapeadas: 1500,
      freteDevolucaoEOutros: 500,
      total: 47000, // 25000+11000+5000+4000+1500+500
    });
    expect(mes.cmv).toBe(90000);

    // Margem de contribuição
    expect(mes.margemContribuicao).toBe(190000); // 327000 - 47000 - 90000
    expect(mes.margemContribuicaoPercentual).toBeCloseTo(190000 / 327000, 10);

    // Despesas operacionais, por categoria e total
    expect(mes.despesasOperacionais).toEqual(
      expect.arrayContaining([
        { categoriaId: "cat-pessoal", nome: "Pessoal", valor: 12000 },
        { categoriaId: "cat-software", nome: "Software e assinaturas", valor: 2500 },
      ])
    );
    expect(mes.totalDespesasOperacionais).toBe(14500);
    expect(mes.resultadoOperacional).toBe(175500); // 190000 - 14500

    // Resultado financeiro: Rendimentos (receita) soma, Juros (despesa) subtrai — líquido +700
    expect(mes.resultadoFinanceiro).toBe(700);

    // Imposto sobre o lucro (regime PRESUMIDO cobra o que foi lançado)
    expect(mes.impostoLucro).toBe(6000);

    // Lucro líquido final
    expect(mes.lucroLiquido).toBe(170200); // 175500 + 700 - 6000
    expect(mes.lucroLiquidoPercentual).toBeCloseTo(170200 / 327000, 10);
  });
});
