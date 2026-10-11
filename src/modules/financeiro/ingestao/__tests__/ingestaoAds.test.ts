import { describe, it, expect, vi, beforeEach } from "vitest";
import { CanalVenda, Confianca, StatusVendaCanal } from "@prisma/client";
import type { AdaptadorCanalFinanceiro, GastoAdsNormalizado } from "../../canais/tipos";

interface FakeItem {
  id: string;
  vendaId: string;
  produtoId: string | null;
  anuncioExternoId: string;
  precoUnitario: number;
  quantidade: number;
  tarifaVenda: number;
  freteRateado: number | null;
  descontoRateado: number;
  impostoRateado: number;
  adsRateado: number;
  custoUnitario: number | null;
  margemContribuicao: number | null;
}

interface FakeVenda {
  id: string;
  userId: string;
  canal: CanalVenda;
  status: StatusVendaCanal;
  dataVenda: Date;
  adsAtribuido: number;
  completo: boolean;
  itens: FakeItem[];
}

interface FakeGastoAds {
  id: string;
  userId: string;
  canal: CanalVenda;
  dia: Date;
  campanhaExternaId: string | null;
  anuncioExternoId: string | null;
  custo: number;
  produtoId: string | null;
}

let contas: Array<{ id: string; userId: string }> = [];
let configuracoes: Array<{ userId: string; aliquotaImposto: number; custoEnvioFlex: number | null }> = [];
let vinculosMl: Array<{ mlItemId: string; mercadoLivreAccountId: string; produtoId: string | null }> = [];
let vendas: FakeVenda[] = [];
let gastosAds: FakeGastoAds[] = [];
let resumos: Array<{ userId: string; dia: Date; canal: CanalVenda } & Record<string, number>> = [];
let proximoId = 1;
const novoId = () => `id-${proximoId++}`;

function resetFakeDb() {
  contas = [];
  configuracoes = [];
  vinculosMl = [];
  vendas = [];
  gastosAds = [];
  resumos = [];
  proximoId = 1;
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mercadoLivreAccount: {
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
        const conta = contas.find((c) => c.id === where.id);
        if (!conta) throw new Error("conta não encontrada");
        return conta;
      }),
    },
    configuracaoGeral: {
      findUnique: vi.fn(async ({ where }: { where: { userId: string } }) =>
        configuracoes.find((c) => c.userId === where.userId) ?? null
      ),
    },
    produtoMercadoLivre: {
      findUnique: vi.fn(
        async ({
          where,
        }: {
          where: {
            mlItemId_mercadoLivreAccountId: { mlItemId: string; mercadoLivreAccountId: string };
          };
        }) => {
          const chave = where.mlItemId_mercadoLivreAccountId;
          const vinculo = vinculosMl.find(
            (v) => v.mlItemId === chave.mlItemId && v.mercadoLivreAccountId === chave.mercadoLivreAccountId
          );
          return vinculo ? { produtoId: vinculo.produtoId } : null;
        }
      ),
    },
    gastoAdsCanal: {
      findFirst: vi.fn(
        async ({
          where,
        }: {
          where: {
            userId: string;
            canal: CanalVenda;
            dia: Date;
            campanhaExternaId: string | null;
            anuncioExternoId: string | null;
          };
        }) =>
          gastosAds.find(
            (g) =>
              g.userId === where.userId &&
              g.canal === where.canal &&
              g.dia.getTime() === where.dia.getTime() &&
              g.campanhaExternaId === where.campanhaExternaId &&
              g.anuncioExternoId === where.anuncioExternoId
          ) ?? null
      ),
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: { userId: string; canal: CanalVenda; dia: Date };
        }) =>
          gastosAds
            .filter((g) => g.userId === where.userId && g.canal === where.canal && g.dia.getTime() === where.dia.getTime())
            .map((g) => ({ anuncioExternoId: g.anuncioExternoId, custo: g.custo }))
      ),
      create: vi.fn(
        async ({
          data,
        }: {
          data: Omit<FakeGastoAds, "id">;
        }) => {
          const novo = { id: novoId(), ...data };
          gastosAds.push(novo);
          return novo;
        }
      ),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: Partial<FakeGastoAds> }) => {
          const gasto = gastosAds.find((g) => g.id === where.id);
          if (!gasto) throw new Error("gasto não encontrado");
          Object.assign(gasto, data);
          return gasto;
        }
      ),
      aggregate: vi.fn(
        async ({
          where,
        }: {
          where: { userId: string; canal: CanalVenda; dia: { gte: Date; lte: Date } };
        }) => {
          const soma = gastosAds
            .filter(
              (g) =>
                g.userId === where.userId &&
                g.canal === where.canal &&
                g.dia.getTime() >= where.dia.gte.getTime() &&
                g.dia.getTime() <= where.dia.lte.getTime()
            )
            .reduce((total, g) => total + g.custo, 0);
          return { _sum: { custo: soma } };
        }
      ),
    },
    vendaCanal: {
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
        const venda = vendas.find((v) => v.id === where.id);
        if (!venda) throw new Error("venda não encontrada");
        return venda;
      }),
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: { userId: string; canal: CanalVenda; dataVenda: { gte: Date; lte: Date } };
        }) =>
          vendas
            .filter(
              (v) =>
                v.userId === where.userId &&
                v.canal === where.canal &&
                v.dataVenda.getTime() >= where.dataVenda.gte.getTime() &&
                v.dataVenda.getTime() <= where.dataVenda.lte.getTime()
            )
            .map((v) => ({
              status: v.status,
              faturamentoBruto: v.itens.reduce((s, i) => s + i.precoUnitario * i.quantidade, 0),
              descontoVendedor: 0,
              tarifaVenda: 0,
              freteVendedor: 0,
              impostoEstimado: 0,
              adsAtribuido: v.adsAtribuido,
              cmv: 0,
              margemContribuicao: v.itens.reduce((s, i) => s + (i.margemContribuicao ?? 0), 0),
              completo: v.completo,
              itens: v.itens.map((i) => ({ quantidade: i.quantidade })),
            }))
      ),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: Partial<FakeVenda> }) => {
          const venda = vendas.find((v) => v.id === where.id);
          if (!venda) throw new Error("venda não encontrada");
          Object.assign(venda, data);
          return venda;
        }
      ),
    },
    vendaCanalItem: {
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: {
            anuncioExternoId: { in: string[] };
            venda: { userId: string; canal: CanalVenda; dataVenda: { gte: Date; lte: Date } };
          };
        }) => {
          const resultado: Array<FakeItem & { vendaId: string }> = [];
          for (const venda of vendas) {
            if (venda.userId !== where.venda.userId || venda.canal !== where.venda.canal) continue;
            if (
              venda.dataVenda.getTime() < where.venda.dataVenda.gte.getTime() ||
              venda.dataVenda.getTime() > where.venda.dataVenda.lte.getTime()
            )
              continue;
            for (const item of venda.itens) {
              if (where.anuncioExternoId.in.includes(item.anuncioExternoId)) {
                resultado.push(item);
              }
            }
          }
          return resultado;
        }
      ),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: Partial<FakeItem> }) => {
          for (const venda of vendas) {
            const item = venda.itens.find((i) => i.id === where.id);
            if (item) {
              Object.assign(item, data);
              return item;
            }
          }
          throw new Error("item não encontrado");
        }
      ),
    },
    resumoFinanceiroDiario: {
      upsert: vi.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: { userId_dia_canal: { userId: string; dia: Date; canal: CanalVenda } };
          create: { userId: string; dia: Date; canal: CanalVenda } & Record<string, number>;
          update: Record<string, number>;
        }) => {
          const chave = where.userId_dia_canal;
          const existente = resumos.find(
            (r) => r.userId === chave.userId && r.canal === chave.canal && r.dia.getTime() === chave.dia.getTime()
          );
          if (existente) {
            Object.assign(existente, update);
            return existente;
          }
          const novo = { ...create };
          resumos.push(novo);
          return novo;
        }
      ),
    },
    $transaction: vi.fn(async (arg: Array<Promise<unknown>> | ((tx: unknown) => Promise<unknown>)) => {
      if (Array.isArray(arg)) return Promise.all(arg);
      return arg(await import("@/lib/prisma").then((m) => m.prisma));
    }),
  },
}));

const adaptadorFake: { atual: Partial<AdaptadorCanalFinanceiro> } = { atual: {} };
vi.mock("../../canais/registro", () => ({
  obterAdaptador: vi.fn(() => ({ canal: CanalVenda.MERCADO_LIVRE, ...adaptadorFake.atual })),
}));

function gasto(parcial: Partial<GastoAdsNormalizado> = {}): GastoAdsNormalizado {
  return {
    campanhaExternaId: "camp-1",
    anuncioExternoId: "MLB1",
    custo: 1000,
    cliques: 10,
    impressoes: 100,
    vendasAtribuidas: 1,
    receitaAtribuida: 5000,
    ...parcial,
  };
}

function item(parcial: Partial<FakeItem> = {}): FakeItem {
  return {
    id: novoId(),
    vendaId: "",
    produtoId: null,
    anuncioExternoId: "MLB1",
    precoUnitario: 10000,
    quantidade: 1,
    tarifaVenda: 0,
    freteRateado: 0,
    descontoRateado: 0,
    impostoRateado: 0,
    adsRateado: 0,
    custoUnitario: 5000,
    margemContribuicao: null,
    ...parcial,
  };
}

const { ingerirGastosAdsDoDia } = await import("../ingestaoAds");

const DIA = new Date("2026-05-10T03:00:00.000Z"); // meia-noite SP

beforeEach(() => {
  resetFakeDb();
  contas.push({ id: "conta-1", userId: "user-1" });
  configuracoes.push({ userId: "user-1", aliquotaImposto: 0, custoEnvioFlex: null });
  adaptadorFake.atual = {};
});

describe("ingerirGastosAdsDoDia", () => {
  it("persiste o gasto do dia e vincula o produto pelo anúncio", async () => {
    vinculosMl.push({ mlItemId: "MLB1", mercadoLivreAccountId: "conta-1", produtoId: "produto-1" });
    adaptadorFake.atual = { listarGastosAds: vi.fn(async () => [gasto()]) };

    const resultado = await ingerirGastosAdsDoDia("conta-1", DIA);

    expect(resultado.processados).toBe(1);
    expect(gastosAds).toHaveLength(1);
    expect(gastosAds[0].produtoId).toBe("produto-1");
    expect(gastosAds[0].custo).toBe(1000);
  });

  it("reprocessar o mesmo dia atualiza em vez de duplicar", async () => {
    adaptadorFake.atual = { listarGastosAds: vi.fn(async () => [gasto({ custo: 1000 })]) };
    await ingerirGastosAdsDoDia("conta-1", DIA);

    adaptadorFake.atual = { listarGastosAds: vi.fn(async () => [gasto({ custo: 1500 })]) };
    await ingerirGastosAdsDoDia("conta-1", DIA);

    expect(gastosAds).toHaveLength(1);
    expect(gastosAds[0].custo).toBe(1500);
  });

  it("rateia entre os itens do mesmo anúncio no dia, proporcional ao faturamento", async () => {
    const vendaA: FakeVenda = {
      id: "venda-a", userId: "user-1", canal: CanalVenda.MERCADO_LIVRE, status: StatusVendaCanal.PAGA,
      dataVenda: DIA, adsAtribuido: 0, completo: true,
      itens: [item({ vendaId: "venda-a", precoUnitario: 3000, quantidade: 1 })],
    };
    const vendaB: FakeVenda = {
      id: "venda-b", userId: "user-1", canal: CanalVenda.MERCADO_LIVRE, status: StatusVendaCanal.PAGA,
      dataVenda: DIA, adsAtribuido: 0, completo: true,
      itens: [item({ vendaId: "venda-b", precoUnitario: 7000, quantidade: 1 })],
    };
    vendaA.itens[0].vendaId = "venda-a";
    vendaB.itens[0].vendaId = "venda-b";
    vendas.push(vendaA, vendaB);

    adaptadorFake.atual = { listarGastosAds: vi.fn(async () => [gasto({ custo: 1000 })]) };
    await ingerirGastosAdsDoDia("conta-1", DIA);

    expect(vendaA.adsAtribuido + vendaB.adsAtribuido).toBe(1000);
    expect(vendaB.adsAtribuido).toBeGreaterThan(vendaA.adsAtribuido);
    expect(vendaA.itens[0].margemContribuicao).not.toBeNull();
  });

  it("ads sem venda no dia fica só em GastoAdsCanal, nenhuma venda é tocada", async () => {
    adaptadorFake.atual = { listarGastosAds: vi.fn(async () => [gasto({ anuncioExternoId: "MLB-sem-venda" })]) };

    await ingerirGastosAdsDoDia("conta-1", DIA);

    expect(gastosAds).toHaveLength(1);
    expect(vendas).toHaveLength(0);
  });

  it("venda com itens de dois anúncios diferentes: cada item recebe o rateio do seu próprio anúncio", async () => {
    const venda: FakeVenda = {
      id: "venda-mista", userId: "user-1", canal: CanalVenda.MERCADO_LIVRE, status: StatusVendaCanal.PAGA,
      dataVenda: DIA, adsAtribuido: 0, completo: true,
      itens: [
        item({ vendaId: "venda-mista", anuncioExternoId: "MLB1", precoUnitario: 5000, quantidade: 1 }),
        item({ vendaId: "venda-mista", anuncioExternoId: "MLB2", precoUnitario: 5000, quantidade: 1 }),
      ],
    };
    vendas.push(venda);

    adaptadorFake.atual = {
      listarGastosAds: vi.fn(async () => [
        gasto({ anuncioExternoId: "MLB1", custo: 400 }),
        gasto({ anuncioExternoId: "MLB2", custo: 600 }),
      ]),
    };

    await ingerirGastosAdsDoDia("conta-1", DIA);

    expect(venda.itens[0].adsRateado).toBe(400);
    expect(venda.itens[1].adsRateado).toBe(600);
    expect(venda.adsAtribuido).toBe(1000);
  });

  it("venda cancelada: faturamento zerado entra no recálculo de margem do item", async () => {
    const venda: FakeVenda = {
      id: "venda-cancelada", userId: "user-1", canal: CanalVenda.MERCADO_LIVRE, status: StatusVendaCanal.CANCELADA,
      dataVenda: DIA, adsAtribuido: 0, completo: true,
      itens: [item({ vendaId: "venda-cancelada", precoUnitario: 10000, quantidade: 1, tarifaVenda: 0, custoUnitario: 0 })],
    };
    vendas.push(venda);

    adaptadorFake.atual = { listarGastosAds: vi.fn(async () => [gasto({ custo: 300 })]) };
    await ingerirGastosAdsDoDia("conta-1", DIA);

    expect(venda.itens[0].margemContribuicao).toBe(-300); // 0 (zerado) - 300 de ads, sem mais custo
  });

  it("sem adaptador de ads (capacidade ausente), não faz nada e não quebra", async () => {
    adaptadorFake.atual = {};

    const resultado = await ingerirGastosAdsDoDia("conta-1", DIA);

    expect(resultado.processados).toBe(0);
    expect(gastosAds).toHaveLength(0);
  });
});
