import { describe, it, expect, vi, beforeEach } from "vitest";
import { CanalVenda } from "@prisma/client";
import type { AdaptadorCanalFinanceiro, CobrancaNormalizada } from "../../canais/tipos";

interface FakeCobranca {
  id: string;
  userId: string;
  canal: CanalVenda;
  mesReferencia: string;
  detalheExternoId: string;
  tipoExterno: string;
  tipoNormalizado: string;
  valor: number;
  coberturaPedido: boolean;
}

let contas: Array<{ id: string; userId: string }> = [];
let cobrancas: FakeCobranca[] = [];
let proximoId = 1;

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mercadoLivreAccount: {
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
        const conta = contas.find((c) => c.id === where.id);
        if (!conta) throw new Error("conta não encontrada");
        return conta;
      }),
    },
    cobrancaCanal: {
      upsert: vi.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: { userId_canal_detalheExternoId: { userId: string; canal: CanalVenda; detalheExternoId: string } };
          create: Omit<FakeCobranca, "id">;
          update: Partial<FakeCobranca>;
        }) => {
          const chave = where.userId_canal_detalheExternoId;
          const existente = cobrancas.find(
            (c) => c.userId === chave.userId && c.canal === chave.canal && c.detalheExternoId === chave.detalheExternoId
          );
          if (existente) {
            Object.assign(existente, update);
            return existente;
          }
          const nova = { id: `id-${proximoId++}`, ...create };
          cobrancas.push(nova);
          return nova;
        }
      ),
    },
  },
}));

const adaptadorFake: { atual: Partial<AdaptadorCanalFinanceiro> } = { atual: {} };
vi.mock("../../canais/registro", () => ({
  obterAdaptador: vi.fn(() => ({ canal: CanalVenda.MERCADO_LIVRE, ...adaptadorFake.atual })),
}));

function cobranca(parcial: Partial<CobrancaNormalizada> = {}): CobrancaNormalizada {
  return {
    detalheExternoId: "det-1",
    tipoExterno: "marketplace_fee",
    tipoNormalizado: "TARIFA_VENDA",
    valor: 1000,
    pedidoExternoId: "1000001",
    anuncioExternoId: null,
    data: new Date("2026-05-10T00:00:00.000Z"),
    coberturaPedido: true,
    ...parcial,
  };
}

const { ingerirCobrancasDoMes } = await import("../ingestaoCobrancas");

beforeEach(() => {
  contas = [{ id: "conta-1", userId: "user-1" }];
  cobrancas = [];
  proximoId = 1;
  adaptadorFake.atual = {};
});

describe("ingerirCobrancasDoMes", () => {
  it("persiste cobranças novas e conta as não mapeadas", async () => {
    adaptadorFake.atual = {
      listarCobrancas: vi.fn(async () => [
        cobranca({ detalheExternoId: "det-1", tipoNormalizado: "TARIFA_VENDA" }),
        cobranca({ detalheExternoId: "det-2", tipoNormalizado: "NAO_MAPEADO" }),
      ]),
    };

    const resultado = await ingerirCobrancasDoMes("conta-1", "2026-05");

    expect(resultado.processadas).toBe(2);
    expect(resultado.naoMapeadas).toBe(1);
    expect(cobrancas).toHaveLength(2);
  });

  it("reprocessar o mesmo mês atualiza em vez de duplicar", async () => {
    adaptadorFake.atual = {
      listarCobrancas: vi.fn(async () => [cobranca({ detalheExternoId: "det-1", valor: 1000 })]),
    };
    await ingerirCobrancasDoMes("conta-1", "2026-05");

    adaptadorFake.atual = {
      listarCobrancas: vi.fn(async () => [cobranca({ detalheExternoId: "det-1", valor: 1500 })]),
    };
    await ingerirCobrancasDoMes("conta-1", "2026-05");

    expect(cobrancas).toHaveLength(1);
    expect(cobrancas[0].valor).toBe(1500);
  });

  it("sem adaptador de cobranças, não faz nada", async () => {
    adaptadorFake.atual = {};

    const resultado = await ingerirCobrancasDoMes("conta-1", "2026-05");

    expect(resultado.processadas).toBe(0);
    expect(cobrancas).toHaveLength(0);
  });
});
