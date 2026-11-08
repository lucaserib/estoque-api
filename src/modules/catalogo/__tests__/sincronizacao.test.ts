import { describe, it, expect, vi, beforeEach } from "vitest";

let estado: Record<string, unknown> | null = null;
let blingConta: Record<string, unknown> | null = { id: "bling-1", ultimaSincronizacaoProdutos: null };
let mlConta: Record<string, unknown> | null = { id: "ml-1", userId: "user-1", siteId: "MLB", mlUserId: "99" };
const produtosLocais = [
  { id: "p1", blingId: "11", estoques: [] },
  { id: "p2", blingId: "22", estoques: [] },
];
const sincronizados: number[] = [];
const anuncios: string[] = [];
let falharBlingProdutos = false;
let permissaoFaltandoNosProdutos: string | null = null;
let relogio = 0;

vi.mock("@/lib/prisma", () => ({
  prisma: {
    sincronizacaoCatalogo: {
      upsert: vi.fn(async () => {
        estado ??= { userId: "user-1", etapa: null, cursor: null, progresso: null, concluidoEm: null, processandoAte: null, erro: null, iniciadoEm: null };
        return estado;
      }),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        for (const [k, v] of Object.entries(data)) {
          const ehNuloJson = v && typeof v === "object" && !(v instanceof Date) && /Null/.test((v as object).constructor?.name ?? "");
          estado![k] = ehNuloJson ? null : v;
        }
        return estado;
      }),
      updateMany: vi.fn(async () => {
        if (estado!.processandoAte && (estado!.processandoAte as Date).getTime() > Date.now()) return { count: 0 };
        estado!.processandoAte = new Date(Date.now() + 60000);
        return { count: 1 };
      }),
      findUnique: vi.fn(async () => estado),
    },
    blingAccount: {
      findFirst: vi.fn(async () => blingConta),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(blingConta!, data)),
    },
    mercadoLivreAccount: { findFirst: vi.fn(async () => mlConta) },
    produto: { findMany: vi.fn(async () => produtosLocais) },
    produtoMercadoLivre: { count: vi.fn(async () => 0), findFirst: vi.fn(async () => null) },
  },
}));
vi.mock("@/lib/cache", () => ({ mlCache: { invalidatePattern: vi.fn(async () => 0) } }));
vi.mock("@/services/blingService", () => ({
  BlingService: {
    getAllProducts: vi.fn(async () => {
      if (falharBlingProdutos) throw new Error("Bling fora do ar");
      return [{ id: 11 }, { id: 22 }, { id: 33 }];
    }),
    getProductsStock: vi.fn(async (_c: string, ids: number[]) => ({
      data: ids.map((id) => ({ produto: { id }, depositos: [{ id: 1, saldoFisico: 7 }] })),
    })),
  },
}));
const aplicarEstoque = vi.fn(async () => []);
vi.mock("@/services/blingProductSync", () => ({
  sincronizarProdutoUnico: vi.fn(async (_c: string, _u: string, id: number) => {
    relogio += 20000;
    sincronizados.push(id);
    return {
      produtoId: `p-${id}`,
      criado: true,
      ...(permissaoFaltandoNosProdutos ? { permissoesFaltando: [permissaoFaltandoNosProdutos] } : {}),
    };
  }),
  garantirArmazensParaDepositos: vi.fn(async () => new Map([["1", { id: "a1" }]])),
  aplicarEstoqueProdutoBling: (...a: unknown[]) => aplicarEstoque(...(a as [])),
}));
vi.mock("@/services/mercadoLivreService", () => ({
  MercadoLivreService: { getValidToken: vi.fn(async () => "token") },
}));
vi.mock("../anunciosMl", () => ({
  listarIdsAnunciosMl: vi.fn(async () => ["MLB1", "MLB2", "MLB3"]),
  sincronizarAnuncioMl: vi.fn(async (_c: unknown, _t: string, id: string) => {
    anuncios.push(id);
    return "ATUALIZADO";
  }),
  registrarErroAnuncio: vi.fn(async () => undefined),
  atualizarEstoqueFullDosAnuncios: vi.fn(async () => 2),
}));

const realNow = Date.now;
const { sincronizarCatalogoSeNecessario, processarSincronizacaoCatalogo } = await import("../sincronizacao");

beforeEach(() => {
  estado = null;
  blingConta = { id: "bling-1", ultimaSincronizacaoProdutos: null };
  mlConta = { id: "ml-1", userId: "user-1", siteId: "MLB", mlUserId: "99" };
  sincronizados.length = 0;
  anuncios.length = 0;
  falharBlingProdutos = false;
  permissaoFaltandoNosProdutos = null;
  relogio = 0;
  aplicarEstoque.mockClear();
  Date.now = () => realNow() + relogio;
});

describe("sincronização de catálogo e estoque", () => {
  it("percorre produtos do Bling, estoque do Bling, anúncios do ML e o estoque Full, e conclui", async () => {
    const status = await sincronizarCatalogoSeNecessario("user-1", 200000);
    expect(sincronizados).toEqual([11, 22, 33]);
    expect(aplicarEstoque).toHaveBeenCalledTimes(2);
    expect(anuncios).toEqual(["MLB1", "MLB2", "MLB3"]);
    expect(status.emAndamento).toBe(false);
    expect(estado!.concluidoEm).toBeInstanceOf(Date);
    expect(blingConta!.ultimaSincronizacaoProdutos).toBeInstanceOf(Date);
    expect(blingConta!.ultimaSincronizacaoEstoque).toBeInstanceOf(Date);
  });

  it("quando o tempo acaba no meio, guarda o cursor e continua do mesmo produto na chamada seguinte", async () => {
    await sincronizarCatalogoSeNecessario("user-1", 30000);
    expect(estado!.etapa).toBe("BLING_PRODUTOS");
    const feitosAntes = sincronizados.length;
    expect(feitosAntes).toBeGreaterThan(0);
    expect(feitosAntes).toBeLessThan(3);

    relogio = 0;
    await processarSincronizacaoCatalogo("user-1", 200000);
    expect(sincronizados).toEqual([11, 22, 33]);
    expect(estado!.etapa).toBeNull();
  });

  it("uma etapa com erro é registrada e não impede o estoque nem os anúncios", async () => {
    falharBlingProdutos = true;
    const status = await sincronizarCatalogoSeNecessario("user-1", 200000);
    expect(status.erro).toContain("Bling fora do ar");
    expect(aplicarEstoque).toHaveBeenCalled();
    expect(anuncios).toHaveLength(3);
  });

  it("sem a permissão de Contatos no Bling, todos os produtos entram e o aviso aparece uma vez só", async () => {
    permissaoFaltandoNosProdutos = "Contatos (leitura)";
    const status = await sincronizarCatalogoSeNecessario("user-1", 200000);
    expect(sincronizados).toEqual([11, 22, 33]);
    expect(status.erro).toBeNull();
    const etapa = status.progresso.BLING_PRODUTOS!;
    expect(etapa).toMatchObject({ feitos: 3, total: 3, erros: 0, permissoesFaltando: ["Contatos (leitura)"] });
    expect(etapa.avisos).toHaveLength(1);
    expect(etapa.avisos![0]).toContain("Reconectar");
    expect(blingConta!.ultimaSincronizacaoProdutos).toBeInstanceOf(Date);
  });

  it("não começa outra rodada se a última terminou há menos de 6 horas", async () => {
    await sincronizarCatalogoSeNecessario("user-1", 200000);
    sincronizados.length = 0;
    await sincronizarCatalogoSeNecessario("user-1", 200000);
    expect(sincronizados).toHaveLength(0);
    await sincronizarCatalogoSeNecessario("user-1", 200000, { forcar: true });
    expect(sincronizados.length).toBeGreaterThan(0);
  });
});
