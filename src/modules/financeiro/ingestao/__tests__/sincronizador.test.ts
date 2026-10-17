import { describe, it, expect, vi, beforeEach } from "vitest";
import { CanalVenda, Confianca, StatusVendaCanal } from "@prisma/client";
import type { AdaptadorCanalFinanceiro, VendaCanalNormalizada } from "../../canais/tipos";

interface FakeItem {
  id: string;
  vendaId: string;
  produtoId: string | null;
  sku: string | null;
  anuncioExternoId: string;
  variacaoExternaId: string | null;
  titulo: string;
  quantidade: number;
  precoUnitario: number;
  precoCheio: number | null;
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
  contaCanalId: string;
  pedidoExternoId: string;
  pacoteExternoId: string | null;
  dataVenda: Date;
  dataCancelamento: Date | null;
  dataLiberacao: Date | null;
  status: StatusVendaCanal;
  logistica: string | null;
  envioExternoId: string | null;
  faturamentoBruto: number;
  descontoVendedor: number;
  tarifaVenda: number;
  freteVendedor: number | null;
  freteComprador: number;
  impostoEstimado: number;
  adsAtribuido: number;
  cmv: number | null;
  outrosCustos: number;
  margemContribuicao: number | null;
  valorLiquidoReceber: number | null;
  completo: boolean;
  faltando: string[];
  freteConfianca: Confianca;
  atualizadoNoCanalEm: Date;
  itens: FakeItem[];
}

interface FakeSincronizacao {
  id: string;
  userId: string;
  canal: CanalVenda;
  tipo: string;
  cursor: unknown;
  status: string;
  processados: number;
  erro: string | null;
  iniciadoEm: Date;
}

let contas: Array<{ id: string; userId: string; mlUserId: string; ultimaSincronizacaoFinanceiraEm?: Date | null }> = [];
let configuracoes: Array<{ userId: string; aliquotaImposto: number; custoEnvioFlex: number | null }> = [];
let vinculosMl: Array<{ mlItemId: string; mercadoLivreAccountId: string; produtoId: string | null }> = [];
let produtos: Array<{ id: string; sku: string; userId: string; isKit: boolean; custoMedio: number | null }> = [];
let vendas: FakeVenda[] = [];
let gastosAds: Array<{ userId: string; canal: CanalVenda; dia: Date; custo: number }> = [];
let resumos: Array<{ userId: string; dia: Date; canal: CanalVenda } & Record<string, number>> = [];
let sincronizacoes: FakeSincronizacao[] = [];
let errosSincronizacao: Array<{
  id: string;
  userId: string;
  canal: CanalVenda;
  pedidoExternoId: string;
  etapa: string;
  mensagem: string;
  tentativas: number;
  ultimoErroEm: Date;
  resolvidoEm: Date | null;
}> = [];
let proximoId = 1;
const novoId = () => `id-${proximoId++}`;

function resetFakeDb() {
  contas = [];
  configuracoes = [];
  vinculosMl = [];
  produtos = [];
  vendas = [];
  gastosAds = [];
  resumos = [];
  sincronizacoes = [];
  errosSincronizacao = [];
  proximoId = 1;
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mercadoLivreAccount: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        contas.find((c) => c.id === where.id) ?? null
      ),
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
        const conta = contas.find((c) => c.id === where.id);
        if (!conta) throw new Error("conta não encontrada");
        return conta;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const conta = contas.find((c) => c.id === where.id);
        if (!conta) throw new Error("conta não encontrada");
        Object.assign(conta, data);
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
    produto: {
      findUnique: vi.fn(
        async ({
          where,
        }: {
          where: { id?: string; sku_userId?: { sku: string; userId: string } };
        }) => {
          if (where.id) {
            const produto = produtos.find((p) => p.id === where.id);
            return produto ? { id: produto.id, isKit: produto.isKit, custoMedio: produto.custoMedio } : null;
          }
          if (where.sku_userId) {
            const produto = produtos.find(
              (p) => p.sku === where.sku_userId!.sku && p.userId === where.sku_userId!.userId
            );
            return produto ? { id: produto.id } : null;
          }
          return null;
        }
      ),
    },
    componente: {
      findMany: vi.fn(async () => []),
    },
    gastoAdsCanal: {
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
      findUnique: vi.fn(
        async ({
          where,
        }: {
          where: { userId_canal_pedidoExternoId: { userId: string; canal: CanalVenda; pedidoExternoId: string } };
        }) => {
          const chave = where.userId_canal_pedidoExternoId;
          return (
            vendas.find(
              (v) => v.userId === chave.userId && v.canal === chave.canal && v.pedidoExternoId === chave.pedidoExternoId
            ) ?? null
          );
        }
      ),
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
        const venda = vendas.find((v) => v.id === where.id);
        if (!venda) throw new Error("venda não encontrada");
        return venda;
      }),
      findMany: vi.fn(
        async (args: {
          where: {
            userId: string;
            canal: CanalVenda;
            pacoteExternoId?: string | null;
            pedidoExternoId?: { not: string };
            dataVenda?: { gte: Date; lte: Date };
          };
        }) => {
          const { where } = args;
          if (where.pacoteExternoId !== undefined) {
            return vendas
              .filter(
                (v) =>
                  v.userId === where.userId &&
                  v.canal === where.canal &&
                  v.pacoteExternoId === where.pacoteExternoId &&
                  v.pedidoExternoId !== where.pedidoExternoId?.not
              )
              .map((v) => ({ id: v.id, faturamentoBruto: v.faturamentoBruto }));
          }

          const periodo = where.dataVenda!;
          return vendas
            .filter(
              (v) =>
                v.userId === where.userId &&
                v.canal === where.canal &&
                v.dataVenda.getTime() >= periodo.gte.getTime() &&
                v.dataVenda.getTime() <= periodo.lte.getTime()
            )
            .map((v) => ({
              status: v.status,
              faturamentoBruto: v.faturamentoBruto,
              descontoVendedor: v.descontoVendedor,
              tarifaVenda: v.tarifaVenda,
              freteVendedor: v.freteVendedor,
              impostoEstimado: v.impostoEstimado,
              adsAtribuido: v.adsAtribuido,
              cmv: v.cmv,
              margemContribuicao: v.margemContribuicao,
              completo: v.completo,
              itens: v.itens.map((i) => ({ quantidade: i.quantidade })),
            }));
        }
      ),
      upsert: vi.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: { userId_canal_pedidoExternoId: { userId: string; canal: CanalVenda; pedidoExternoId: string } };
          create: Omit<FakeVenda, "id" | "itens">;
          update: Partial<FakeVenda>;
        }) => {
          const chave = where.userId_canal_pedidoExternoId;
          const existente = vendas.find(
            (v) => v.userId === chave.userId && v.canal === chave.canal && v.pedidoExternoId === chave.pedidoExternoId
          );
          if (existente) {
            Object.assign(existente, update);
            return existente;
          }
          const nova: FakeVenda = { id: novoId(), itens: [], ...create };
          vendas.push(nova);
          return nova;
        }
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
      deleteMany: vi.fn(async ({ where }: { where: { vendaId: string } }) => {
        const venda = vendas.find((v) => v.id === where.vendaId);
        if (venda) venda.itens = [];
        return { count: 0 };
      }),
      createMany: vi.fn(async ({ data }: { data: Array<Omit<FakeItem, "id">> }) => {
        for (const item of data) {
          const venda = vendas.find((v) => v.id === item.vendaId);
          if (venda) venda.itens.push({ id: novoId(), ...item });
        }
        return { count: data.length };
      }),
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
    sincronizacaoFinanceiraErro: {
      findUnique: vi.fn(
        async ({
          where,
        }: {
          where: {
            userId_canal_pedidoExternoId_etapa: {
              userId: string;
              canal: CanalVenda;
              pedidoExternoId: string;
              etapa: string;
            };
          };
        }) => {
          const chave = where.userId_canal_pedidoExternoId_etapa;
          return (
            errosSincronizacao.find(
              (e) =>
                e.userId === chave.userId &&
                e.canal === chave.canal &&
                e.pedidoExternoId === chave.pedidoExternoId &&
                e.etapa === chave.etapa
            ) ?? null
          );
        }
      ),
      upsert: vi.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: {
            userId_canal_pedidoExternoId_etapa: {
              userId: string;
              canal: CanalVenda;
              pedidoExternoId: string;
              etapa: string;
            };
          };
          create: { userId: string; canal: CanalVenda; pedidoExternoId: string; etapa: string; mensagem: string };
          update: { mensagem: string; tentativas: { increment: number }; ultimoErroEm: Date; resolvidoEm: null };
        }) => {
          const chave = where.userId_canal_pedidoExternoId_etapa;
          const existente = errosSincronizacao.find(
            (e) =>
              e.userId === chave.userId &&
              e.canal === chave.canal &&
              e.pedidoExternoId === chave.pedidoExternoId &&
              e.etapa === chave.etapa
          );
          if (existente) {
            existente.mensagem = update.mensagem;
            existente.tentativas += update.tentativas.increment;
            existente.ultimoErroEm = update.ultimoErroEm;
            existente.resolvidoEm = null;
            return existente;
          }
          const novo = {
            id: novoId(),
            tentativas: 1,
            ultimoErroEm: new Date(),
            resolvidoEm: null,
            ...create,
          };
          errosSincronizacao.push(novo);
          return novo;
        }
      ),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { userId: string; canal: CanalVenda; pedidoExternoId: string; resolvidoEm: null };
          data: { resolvidoEm: Date };
        }) => {
          const afetados = errosSincronizacao.filter(
            (e) =>
              e.userId === where.userId &&
              e.canal === where.canal &&
              e.pedidoExternoId === where.pedidoExternoId &&
              e.resolvidoEm === null
          );
          afetados.forEach((e) => (e.resolvidoEm = data.resolvidoEm));
          return { count: afetados.length };
        }
      ),
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: { userId: string; canal: CanalVenda; resolvidoEm: null; tentativas: { lt: number } };
        }) =>
          errosSincronizacao.filter(
            (e) =>
              e.userId === where.userId &&
              e.canal === where.canal &&
              e.resolvidoEm === null &&
              e.tentativas < where.tentativas.lt
          )
      ),
    },
    sincronizacaoFinanceira: {
      findFirst: vi.fn(
        async ({
          where,
        }: {
          where: { userId: string; canal: CanalVenda; tipo: string; status: string };
        }) =>
          sincronizacoes.find(
            (s) =>
              s.userId === where.userId &&
              s.canal === where.canal &&
              s.tipo === where.tipo &&
              s.status === where.status
          ) ?? null
      ),
      create: vi.fn(
        async ({
          data,
        }: {
          data: { userId: string; canal: CanalVenda; tipo: string; status: string; cursor: unknown };
        }) => {
          const nova: FakeSincronizacao = {
            id: novoId(),
            processados: 0,
            erro: null,
            iniciadoEm: new Date(),
            ...data,
          };
          sincronizacoes.push(nova);
          return nova;
        }
      ),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: {
            status?: string;
            concluidoEm?: Date;
            cursor?: unknown;
            erro?: string;
            processados?: { increment: number };
          };
        }) => {
          const sincronizacao = sincronizacoes.find((s) => s.id === where.id);
          if (!sincronizacao) throw new Error("sincronização não encontrada");
          if (data.status !== undefined) sincronizacao.status = data.status;
          if (data.cursor !== undefined) sincronizacao.cursor = data.cursor;
          if (data.erro !== undefined) sincronizacao.erro = data.erro;
          if (data.processados?.increment != null) {
            sincronizacao.processados += data.processados.increment;
          }
          return sincronizacao;
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
  obterAdaptador: vi.fn(() => ({
    canal: CanalVenda.MERCADO_LIVRE,
    ...adaptadorFake.atual,
  })),
}));

function normalizado(parcial: Partial<VendaCanalNormalizada> = {}): VendaCanalNormalizada {
  return {
    pedidoExternoId: "1000001",
    pacoteExternoId: null,
    dataVenda: new Date("2026-05-10T18:00:00.000Z"),
    dataCancelamento: null,
    dataLiberacao: null,
    status: StatusVendaCanal.PAGA,
    logistica: "drop_off",
    envioExternoId: "555",
    freteComprador: 0,
    descontoVendedorTotal: 0,
    descontoCusteadoPeloMlTotal: 0,
    atualizadoNoCanalEm: new Date("2026-05-10T18:00:00.000Z"),
    itens: [
      {
        anuncioExternoId: "MLB1",
        variacaoExternaId: null,
        sku: "SKU-1",
        titulo: "Produto 1",
        quantidade: 1,
        precoUnitario: 10000,
        precoCheio: null,
        tarifaTotal: 1000,
      },
    ],
    ...parcial,
  };
}

const { ingerirPedidoMercadoLivre, reprocessarUltimosDias, reprocessarErrosPendentes, continuarBackfill, atualizarResumoDoDia } =
  await import("../sincronizador");

beforeEach(() => {
  resetFakeDb();
  contas.push({ id: "conta-1", userId: "user-1", mlUserId: "999" });
  configuracoes.push({ userId: "user-1", aliquotaImposto: 0, custoEnvioFlex: 1500 });
  adaptadorFake.atual = {};
  process.env.FINANCEIRO_TEMPO_MAXIMO_LOTE_MS = "20";
});

describe("ingerirPedidoMercadoLivre", () => {
  it("ingere um pedido pago vinculado por ProdutoMercadoLivre e congela o custo", async () => {
    produtos.push({ id: "produto-1", sku: "SKU-1", userId: "user-1", isKit: false, custoMedio: 5000 });
    vinculosMl.push({ mlItemId: "MLB1", mercadoLivreAccountId: "conta-1", produtoId: "produto-1" });
    adaptadorFake.atual = {
      obterPedido: vi.fn(async () => normalizado()),
      obterCustoEnvio: vi.fn(async () => ({ valor: 800, confianca: Confianca.CONFIRMADO })),
    };

    const resultado = await ingerirPedidoMercadoLivre("conta-1", "1000001");

    expect(resultado.ingerido).toBe(true);
    expect(vendas).toHaveLength(1);
    expect(vendas[0].faturamentoBruto).toBe(10000);
    expect(vendas[0].itens[0].produtoId).toBe("produto-1");
    expect(vendas[0].itens[0].custoUnitario).toBe(5000);
    expect(vendas[0].completo).toBe(true);
    expect(vendas[0].valorLiquidoReceber).toBe(8200); // 10000 - 0 (desconto) - 1000 (tarifa) - 800 (frete)
  });

  it("valorLiquidoReceber fica null quando a tarifa ou o frete ainda são desconhecidos", async () => {
    adaptadorFake.atual = { obterPedido: vi.fn(async () => normalizado()) }; // sem obterCustoEnvio: frete desconhecido

    await ingerirPedidoMercadoLivre("conta-1", "1000001");

    expect(vendas[0].valorLiquidoReceber).toBeNull();
  });

  it("vincula por SKU normalizado quando não há ProdutoMercadoLivre", async () => {
    produtos.push({ id: "produto-2", sku: "SKU-1", userId: "user-1", isKit: false, custoMedio: 3000 });
    adaptadorFake.atual = { obterPedido: vi.fn(async () => normalizado()) };

    await ingerirPedidoMercadoLivre("conta-1", "1000001");

    expect(vendas[0].itens[0].produtoId).toBe("produto-2");
  });

  it("sem vínculo nenhum: produtoId null, pendência SEM_VINCULO, venda incompleta", async () => {
    adaptadorFake.atual = { obterPedido: vi.fn(async () => normalizado()) };

    await ingerirPedidoMercadoLivre("conta-1", "1000001");

    expect(vendas[0].itens[0].produtoId).toBeNull();
    expect(vendas[0].completo).toBe(false);
    expect(vendas[0].faltando).toContain("SEM_VINCULO");
  });

  it("custo fica congelado: reprocessar não sobrescreve um custoUnitario já gravado", async () => {
    produtos.push({ id: "produto-1", sku: "SKU-1", userId: "user-1", isKit: false, custoMedio: 5000 });
    vinculosMl.push({ mlItemId: "MLB1", mercadoLivreAccountId: "conta-1", produtoId: "produto-1" });
    adaptadorFake.atual = { obterPedido: vi.fn(async () => normalizado()) };

    await ingerirPedidoMercadoLivre("conta-1", "1000001");
    expect(vendas[0].itens[0].custoUnitario).toBe(5000);

    const produto1 = produtos.find((p) => p.id === "produto-1")!;
    produto1.custoMedio = 9000; // custo do produto mudou depois da venda

    await ingerirPedidoMercadoLivre("conta-1", "1000001"); // reprocessamento (ex.: cron diário)

    expect(vendas).toHaveLength(1); // upsert, não duplica
    expect(vendas[0].itens[0].custoUnitario).toBe(5000); // preservado, não 9000
  });

  it("preenche o custo congelado quando ele estava nulo na primeira ingestão", async () => {
    adaptadorFake.atual = { obterPedido: vi.fn(async () => normalizado()) };
    await ingerirPedidoMercadoLivre("conta-1", "1000001");
    expect(vendas[0].itens[0].custoUnitario).toBeNull();

    produtos.push({ id: "produto-1", sku: "SKU-1", userId: "user-1", isKit: false, custoMedio: 4000 });
    vinculosMl.push({ mlItemId: "MLB1", mercadoLivreAccountId: "conta-1", produtoId: "produto-1" });

    await ingerirPedidoMercadoLivre("conta-1", "1000001");
    expect(vendas[0].itens[0].custoUnitario).toBe(4000);
  });

  it("pedido ainda não relevante para o financeiro não é ingerido", async () => {
    adaptadorFake.atual = { obterPedido: vi.fn(async () => null) };

    const resultado = await ingerirPedidoMercadoLivre("conta-1", "1000001");

    expect(resultado.ingerido).toBe(false);
    expect(vendas).toHaveLength(0);
  });

  it("Flex sem custo configurado fica com frete desconhecido (SEM_FRETE), não zero inventado", async () => {
    configuracoes[0].custoEnvioFlex = null;
    adaptadorFake.atual = {
      obterPedido: vi.fn(async () => normalizado({ logistica: "self_service" })),
    };

    await ingerirPedidoMercadoLivre("conta-1", "1000001");

    expect(vendas[0].freteVendedor).toBeNull();
    expect(vendas[0].faltando).toContain("SEM_FRETE");
  });

  it("F8 (Ciclo 8): Full também busca o custo real do envio (não existe mais 'Full = frete 0')", async () => {
    const obterCustoEnvioMock = vi.fn(async () => ({ valor: 900, confianca: Confianca.CONFIRMADO }));
    adaptadorFake.atual = {
      obterPedido: vi.fn(async () => normalizado({ logistica: "fulfillment" })),
      obterCustoEnvio: obterCustoEnvioMock,
    };

    await ingerirPedidoMercadoLivre("conta-1", "1000001");

    expect(vendas[0].freteVendedor).toBe(900);
    expect(obterCustoEnvioMock).toHaveBeenCalled();
  });

  it("carrinho com pacote e frete único: rateia entre os dois pedidos e atualiza o irmão já ingerido", async () => {
    adaptadorFake.atual = {
      obterPedido: vi.fn(async (_conta, pedidoExternoId: string) => {
        if (pedidoExternoId === "A") {
          return normalizado({
            pedidoExternoId: "A",
            pacoteExternoId: "pack-1",
            envioExternoId: "777",
            itens: [
              { anuncioExternoId: "MLB1", variacaoExternaId: null, sku: null, titulo: "Item A", quantidade: 1, precoUnitario: 3000, precoCheio: null, tarifaTotal: 0 },
            ],
          });
        }
        return normalizado({
          pedidoExternoId: "B",
          pacoteExternoId: "pack-1",
          envioExternoId: "777",
          itens: [
            { anuncioExternoId: "MLB2", variacaoExternaId: null, sku: null, titulo: "Item B", quantidade: 1, precoUnitario: 7000, precoCheio: null, tarifaTotal: 0 },
          ],
        });
      }),
      obterCustoEnvio: vi.fn(async () => ({ valor: 1000, confianca: Confianca.CONFIRMADO })),
    };

    await ingerirPedidoMercadoLivre("conta-1", "A");
    const vendaA = vendas.find((v) => v.pedidoExternoId === "A")!;
    expect(vendaA.freteVendedor).toBe(1000); // só pedido A conhecido até aqui, fica com o frete inteiro

    await ingerirPedidoMercadoLivre("conta-1", "B");
    const vendaAAtualizada = vendas.find((v) => v.pedidoExternoId === "A")!;
    const vendaB = vendas.find((v) => v.pedidoExternoId === "B")!;

    expect(vendaAAtualizada.freteVendedor! + vendaB.freteVendedor!).toBe(1000);
    expect(vendaB.freteVendedor!).toBeGreaterThan(vendaAAtualizada.freteVendedor!); // B faturou mais
  });
});

describe("atualizarResumoDoDia", () => {
  it("soma vendas pagas e separa cancelamentos pelo valor original", async () => {
    const dia = new Date("2026-05-10T15:00:00.000Z");
    vendas.push({
      id: "v1", userId: "user-1", canal: CanalVenda.MERCADO_LIVRE, contaCanalId: "conta-1",
      pedidoExternoId: "P1", pacoteExternoId: null, dataVenda: dia, dataCancelamento: null, dataLiberacao: null,
      status: StatusVendaCanal.PAGA, logistica: null, envioExternoId: null,
      faturamentoBruto: 10000, descontoVendedor: 0, tarifaVenda: 1000, freteVendedor: 500, freteComprador: 0,
      impostoEstimado: 0, adsAtribuido: 0, cmv: 4000, outrosCustos: 0, margemContribuicao: 4500,
      valorLiquidoReceber: null, completo: true, faltando: [], freteConfianca: Confianca.CONFIRMADO,
      atualizadoNoCanalEm: dia, itens: [{ id: "i1", vendaId: "v1", produtoId: null, sku: null, anuncioExternoId: "a", variacaoExternaId: null, titulo: "x", quantidade: 2, precoUnitario: 5000, precoCheio: null, tarifaVenda: 1000, freteRateado: 500, descontoRateado: 0, impostoRateado: 0, adsRateado: 0, custoUnitario: 2000, margemContribuicao: 4500 }],
    });
    vendas.push({
      id: "v2", userId: "user-1", canal: CanalVenda.MERCADO_LIVRE, contaCanalId: "conta-1",
      pedidoExternoId: "P2", pacoteExternoId: null, dataVenda: dia, dataCancelamento: dia, dataLiberacao: null,
      status: StatusVendaCanal.CANCELADA, logistica: null, envioExternoId: null,
      faturamentoBruto: 8000, descontoVendedor: 0, tarifaVenda: 0, freteVendedor: 0, freteComprador: 0,
      impostoEstimado: 0, adsAtribuido: 0, cmv: 0, outrosCustos: 0, margemContribuicao: 0,
      valorLiquidoReceber: null, completo: true, faltando: [], freteConfianca: Confianca.CONFIRMADO,
      atualizadoNoCanalEm: dia, itens: [],
    });

    await atualizarResumoDoDia("user-1", CanalVenda.MERCADO_LIVRE, dia);

    const resumo = resumos[0];
    expect(resumo.pedidos).toBe(2);
    expect(resumo.faturamentoBruto).toBe(18000);
    expect(resumo.cancelamentos).toBe(8000); // valor original do cancelamento
    expect(resumo.unidades).toBe(2);
  });

  it("F7 (Ciclo 8): faturamentoBruto inclui a venda depois cancelada; cancelamentos guarda o valor dela à parte", async () => {
    const dia = new Date("2026-05-11T15:00:00.000Z");
    vendas.push({
      id: "v3", userId: "user-1", canal: CanalVenda.MERCADO_LIVRE, contaCanalId: "conta-1",
      pedidoExternoId: "P3", pacoteExternoId: null, dataVenda: dia, dataCancelamento: null, dataLiberacao: null,
      status: StatusVendaCanal.PAGA, logistica: null, envioExternoId: null,
      faturamentoBruto: 10000, descontoVendedor: 0, tarifaVenda: 0, freteVendedor: 0, freteComprador: 0,
      impostoEstimado: 0, adsAtribuido: 0, cmv: 0, outrosCustos: 0, margemContribuicao: 10000,
      valorLiquidoReceber: null, completo: true, faltando: [], freteConfianca: Confianca.CONFIRMADO,
      atualizadoNoCanalEm: dia, itens: [],
    });
    vendas.push({
      id: "v4", userId: "user-1", canal: CanalVenda.MERCADO_LIVRE, contaCanalId: "conta-1",
      pedidoExternoId: "P4", pacoteExternoId: null, dataVenda: dia, dataCancelamento: dia, dataLiberacao: null,
      status: StatusVendaCanal.CANCELADA, logistica: null, envioExternoId: null,
      faturamentoBruto: 5000, descontoVendedor: 0, tarifaVenda: 0, freteVendedor: 0, freteComprador: 0,
      impostoEstimado: 0, adsAtribuido: 0, cmv: 0, outrosCustos: 0, margemContribuicao: 0,
      valorLiquidoReceber: null, completo: true, faltando: [], freteConfianca: Confianca.CONFIRMADO,
      atualizadoNoCanalEm: dia, itens: [],
    });

    await atualizarResumoDoDia("user-1", CanalVenda.MERCADO_LIVRE, dia);

    const resumo = resumos[0];
    expect(resumo.faturamentoBruto).toBe(15000);
    expect(resumo.cancelamentos).toBe(5000);
  });
});

describe("reprocessarUltimosDias", () => {
  it("itera todas as páginas e ingere cada pedido retornado", async () => {
    const obterPedidoMock = vi.fn(async (_conta: unknown, id: string) => normalizado({ pedidoExternoId: id }));
    const listarPedidosAlteradosMock = vi
      .fn()
      .mockResolvedValueOnce({
        pedidos: [{ pedidoExternoId: "1", atualizadoNoCanalEm: new Date() }],
        cursor: "50",
        temMais: true,
      })
      .mockResolvedValueOnce({
        pedidos: [{ pedidoExternoId: "2", atualizadoNoCanalEm: new Date() }],
        cursor: null,
        temMais: false,
      });

    adaptadorFake.atual = {
      obterPedido: obterPedidoMock,
      listarPedidosAlterados: listarPedidosAlteradosMock,
    };

    const resultado = await reprocessarUltimosDias("conta-1", 3);

    expect(resultado.processados).toBe(2);
    expect(listarPedidosAlteradosMock).toHaveBeenCalledTimes(2);
    expect(vendas.map((v) => v.pedidoExternoId).sort()).toEqual(["1", "2"]);
  });

  it("F4 (Ciclo 8): um pedido com erro não interrompe os demais do lote", async () => {
    const obterPedidoMock = vi.fn(async (_conta: unknown, id: string) => {
      if (id === "2") throw new Error("falha simulada no pedido 2");
      return normalizado({ pedidoExternoId: id });
    });
    adaptadorFake.atual = {
      obterPedido: obterPedidoMock,
      listarPedidosAlterados: vi.fn(async () => ({
        pedidos: [
          { pedidoExternoId: "1", atualizadoNoCanalEm: new Date() },
          { pedidoExternoId: "2", atualizadoNoCanalEm: new Date() },
          { pedidoExternoId: "3", atualizadoNoCanalEm: new Date() },
        ],
        cursor: null,
        temMais: false,
      })),
    };

    const resultado = await reprocessarUltimosDias("conta-1", 3);

    expect(resultado.processados).toBe(3);
    expect(vendas.map((v) => v.pedidoExternoId).sort()).toEqual(["1", "3"]);
    expect(errosSincronizacao).toHaveLength(1);
    expect(errosSincronizacao[0].pedidoExternoId).toBe("2");
    expect(errosSincronizacao[0].resolvidoEm).toBeNull();
  });

  it("F4 (Ciclo 8): sucesso depois de um erro resolve a pendência", async () => {
    errosSincronizacao.push({
      id: "erro-1", userId: "user-1", canal: CanalVenda.MERCADO_LIVRE, pedidoExternoId: "1",
      etapa: "INCREMENTAL", mensagem: "falha anterior", tentativas: 1, ultimoErroEm: new Date(), resolvidoEm: null,
    });
    adaptadorFake.atual = {
      obterPedido: vi.fn(async (_conta: unknown, id: string) => normalizado({ pedidoExternoId: id })),
      listarPedidosAlterados: vi.fn(async () => ({
        pedidos: [{ pedidoExternoId: "1", atualizadoNoCanalEm: new Date() }],
        cursor: null,
        temMais: false,
      })),
    };

    await reprocessarUltimosDias("conta-1", 3);

    expect(errosSincronizacao[0].resolvidoEm).not.toBeNull();
  });

  it("F4 (Ciclo 8): depois de 5 tentativas, para de reprocessar o mesmo pedido", async () => {
    errosSincronizacao.push({
      id: "erro-1", userId: "user-1", canal: CanalVenda.MERCADO_LIVRE, pedidoExternoId: "1",
      etapa: "INCREMENTAL", mensagem: "falha anterior", tentativas: 5, ultimoErroEm: new Date(), resolvidoEm: null,
    });
    const obterPedidoMock = vi.fn(async (_conta: unknown, id: string) => normalizado({ pedidoExternoId: id }));
    adaptadorFake.atual = {
      obterPedido: obterPedidoMock,
      listarPedidosAlterados: vi.fn(async () => ({
        pedidos: [{ pedidoExternoId: "1", atualizadoNoCanalEm: new Date() }],
        cursor: null,
        temMais: false,
      })),
    };

    await reprocessarUltimosDias("conta-1", 3);

    expect(obterPedidoMock).not.toHaveBeenCalled();
    expect(vendas).toHaveLength(0);
  });

  it("F2 (Ciclo 8): usa a última sincronização (menos 2h de sobreposição) em vez da janela fixa, quando já houve uma", async () => {
    contas[0] = { ...contas[0], ultimaSincronizacaoFinanceiraEm: new Date("2026-05-10T10:00:00.000Z") };
    const listarPedidosAlteradosMock = vi.fn(
      async (_conta: unknown, _desde: Date, _ate: Date, _cursor: string | null) => ({
        pedidos: [],
        cursor: null,
        temMais: false,
      })
    );
    adaptadorFake.atual = { listarPedidosAlterados: listarPedidosAlteradosMock };

    await reprocessarUltimosDias("conta-1", 3);

    const desdeChamado = listarPedidosAlteradosMock.mock.calls[0][1] as Date;
    expect(desdeChamado.toISOString()).toBe("2026-05-10T08:00:00.000Z");
  });
});

describe("reprocessarErrosPendentes", () => {
  it("tenta de novo cada pedido com erro não resolvido e abaixo do limite de tentativas", async () => {
    errosSincronizacao.push(
      { id: "e1", userId: "user-1", canal: CanalVenda.MERCADO_LIVRE, pedidoExternoId: "1", etapa: "INCREMENTAL", mensagem: "falha", tentativas: 2, ultimoErroEm: new Date(), resolvidoEm: null },
      { id: "e2", userId: "user-1", canal: CanalVenda.MERCADO_LIVRE, pedidoExternoId: "2", etapa: "BACKFILL", mensagem: "falha", tentativas: 5, ultimoErroEm: new Date(), resolvidoEm: null },
      { id: "e3", userId: "user-1", canal: CanalVenda.MERCADO_LIVRE, pedidoExternoId: "3", etapa: "INCREMENTAL", mensagem: "falha", tentativas: 1, ultimoErroEm: new Date(), resolvidoEm: new Date() }
    );
    const obterPedidoMock = vi.fn(async (_conta: unknown, id: string) => normalizado({ pedidoExternoId: id }));
    adaptadorFake.atual = { obterPedido: obterPedidoMock };

    const resultado = await reprocessarErrosPendentes("conta-1");

    expect(resultado.processados).toBe(1);
    expect(obterPedidoMock).toHaveBeenCalledWith(expect.anything(), "1");
    expect(obterPedidoMock).not.toHaveBeenCalledWith(expect.anything(), "2");
    expect(obterPedidoMock).not.toHaveBeenCalledWith(expect.anything(), "3");
    expect(errosSincronizacao.find((e) => e.pedidoExternoId === "1")?.resolvidoEm).not.toBeNull();
  });
});

describe("continuarBackfill", () => {
  it("cria a sincronização, processa um lote e fica EM_ANDAMENTO quando ainda há mais páginas", async () => {
    adaptadorFake.atual = {
      obterPedido: vi.fn(async (_conta: unknown, id: string) => normalizado({ pedidoExternoId: id })),
      listarPedidosAlterados: vi.fn(async () => ({
        pedidos: [{ pedidoExternoId: "1", atualizadoNoCanalEm: new Date() }],
        cursor: "50",
        temMais: true,
      })),
    };

    const resultado = await continuarBackfill("conta-1", 90);

    expect(resultado.status).toBe("EM_ANDAMENTO");
    expect(sincronizacoes).toHaveLength(1);
    expect(sincronizacoes[0].status).toBe("EM_ANDAMENTO");
  });

  it("retoma do cursor salvo e conclui quando a última página chega", async () => {
    sincronizacoes.push({
      id: "sinc-1", userId: "user-1", canal: CanalVenda.MERCADO_LIVRE, tipo: "BACKFILL",
      cursor: { desde: "2026-02-01T00:00:00.000Z", ate: "2026-05-01T00:00:00.000Z", offset: 100 },
      status: "EM_ANDAMENTO", processados: 20, erro: null, iniciadoEm: new Date(),
    });

    const listarPedidosAlteradosMock = vi.fn(async () => ({
      pedidos: [{ pedidoExternoId: "1", atualizadoNoCanalEm: new Date() }],
      cursor: null,
      temMais: false,
    }));
    adaptadorFake.atual = {
      obterPedido: vi.fn(async (_conta: unknown, id: string) => normalizado({ pedidoExternoId: id })),
      listarPedidosAlterados: listarPedidosAlteradosMock,
    };

    const resultado = await continuarBackfill("conta-1", 90);

    expect(resultado.status).toBe("CONCLUIDO");
    expect(listarPedidosAlteradosMock).toHaveBeenCalledWith(
      expect.anything(),
      new Date("2026-02-01T00:00:00.000Z"),
      new Date("2026-05-01T00:00:00.000Z"),
      "100"
    );
    expect(sincronizacoes[0].processados).toBe(21);
  });

  it("F4 (Ciclo 8): timeout simulado (orçamento de tempo esgotado) salva o cursor da página e a próxima chamada retoma dali, até concluir", async () => {
    const paginas = [
      { pedidos: [{ pedidoExternoId: "1", atualizadoNoCanalEm: new Date() }], cursor: "50", temMais: true },
      { pedidos: [{ pedidoExternoId: "2", atualizadoNoCanalEm: new Date() }], cursor: null, temMais: false },
    ];
    const listarPedidosAlteradosMock = vi.fn(
      async (_conta: unknown, _desde: Date, _ate: Date, cursor: string | null) =>
        cursor === "50" ? paginas[1] : paginas[0]
    );
    adaptadorFake.atual = {
      obterPedido: vi.fn(async (_conta: unknown, id: string) => normalizado({ pedidoExternoId: id })),
      listarPedidosAlterados: listarPedidosAlteradosMock,
    };

    const nowMock = vi.spyOn(Date, "now");
    nowMock.mockReturnValueOnce(1_000_000);
    nowMock.mockReturnValueOnce(1_000_000);
    nowMock.mockReturnValue(1_000_000 + Number(process.env.FINANCEIRO_TEMPO_MAXIMO_LOTE_MS) + 1);

    const primeiraChamada = await continuarBackfill("conta-1", 90);
    nowMock.mockRestore();

    expect(primeiraChamada.status).toBe("EM_ANDAMENTO");
    expect(sincronizacoes[0].cursor).toEqual(expect.objectContaining({ offset: 50 }));
    expect(vendas.map((v) => v.pedidoExternoId)).toEqual(["1"]);

    const segundaChamada = await continuarBackfill("conta-1", 90);

    expect(segundaChamada.status).toBe("CONCLUIDO");
    expect(listarPedidosAlteradosMock).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), expect.anything(), "50");
    expect(vendas.map((v) => v.pedidoExternoId).sort()).toEqual(["1", "2"]);
  });

  it("F4 (Ciclo 8): erro num pedido não marca a sincronização inteira como ERRO — registra e segue", async () => {
    const obterPedidoMock = vi.fn(async (_conta: unknown, id: string) => {
      if (id === "2") throw new Error("falha simulada");
      return normalizado({ pedidoExternoId: id });
    });
    adaptadorFake.atual = {
      obterPedido: obterPedidoMock,
      listarPedidosAlterados: vi.fn(async () => ({
        pedidos: [
          { pedidoExternoId: "1", atualizadoNoCanalEm: new Date() },
          { pedidoExternoId: "2", atualizadoNoCanalEm: new Date() },
        ],
        cursor: null,
        temMais: false,
      })),
    };

    const resultado = await continuarBackfill("conta-1", 90);

    expect(resultado.status).toBe("CONCLUIDO");
    expect(sincronizacoes[0].status).toBe("CONCLUIDO");
    expect(vendas.map((v) => v.pedidoExternoId)).toEqual(["1"]);
    expect(errosSincronizacao.find((e) => e.pedidoExternoId === "2")).toBeTruthy();
  });
});
