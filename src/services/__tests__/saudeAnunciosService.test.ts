import { describe, it, expect, vi, beforeEach } from "vitest";

const calcularReposicaoContaMock = vi.fn();
vi.mock("../reposicaoService", () => ({
  calcularReposicaoConta: (...args: unknown[]) => calcularReposicaoContaMock(...args),
}));

interface FakeAnuncio {
  id: string;
  mlItemId: string;
  mlTitle: string;
  mlThumbnail: string | null;
  mlPermalink: string | null;
  mlStatus: string;
  mlPrice: number;
  mlAvailableQuantity: number;
  mlFreeShipping: boolean;
  mlTarifaVenda: number | null;
  mlCustoFrete: number | null;
  produtoId: string | null;
  produto: {
    id: string;
    nome: string;
    sku: string;
    isKit: boolean;
    custoMedio: number | null;
    componentes: Array<{ quantidade: number; produto: { custoMedio: number | null } }>;
  } | null;
}

let anuncios: FakeAnuncio[] = [];

const findManyMock = vi.fn(async (..._args: unknown[]) => anuncios);
const findUniqueConfigMock = vi.fn(async (..._args: unknown[]) => ({ aliquotaImposto: 0 }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    produtoMercadoLivre: {
      findMany: (...args: unknown[]) => findManyMock(...args),
    },
    configuracaoGeral: {
      findUnique: (...args: unknown[]) => findUniqueConfigMock(...args),
    },
  },
}));

function anuncioBase(overrides: Partial<FakeAnuncio>): FakeAnuncio {
  return {
    id: "a1",
    mlItemId: "MLB1",
    mlTitle: "Anúncio 1",
    mlThumbnail: null,
    mlPermalink: null,
    mlStatus: "active",
    mlPrice: 10000,
    mlAvailableQuantity: 10,
    mlFreeShipping: false,
    mlTarifaVenda: 1000,
    mlCustoFrete: 0,
    produtoId: "p1",
    produto: {
      id: "p1",
      nome: "Produto 1",
      sku: "SKU1",
      isKit: false,
      custoMedio: 3000,
      componentes: [],
    },
    ...overrides,
  };
}

const { calcularSaudeAnuncios } = await import("../saudeAnunciosService");

beforeEach(() => {
  anuncios = [];
  findManyMock.mockClear();
  findUniqueConfigMock.mockClear();
  calcularReposicaoContaMock.mockReset();
  calcularReposicaoContaMock.mockResolvedValue({ sugestoes: [], parcial: false });
});

describe("calcularSaudeAnuncios", () => {
  it("classifica anúncio pausado", async () => {
    anuncios = [anuncioBase({ id: "a1", mlStatus: "paused" })];

    const resultado = await calcularSaudeAnuncios("conta-1");

    const grupo = resultado.grupos.find((g) => g.categoria === "PAUSADO");
    expect(grupo?.anuncios.map((a) => a.id)).toEqual(["a1"]);
  });

  it("classifica anúncio ativo sem estoque", async () => {
    anuncios = [anuncioBase({ id: "a1", mlAvailableQuantity: 0 })];

    const resultado = await calcularSaudeAnuncios("conta-1");

    const grupo = resultado.grupos.find((g) => g.categoria === "SEM_ESTOQUE");
    expect(grupo?.anuncios.map((a) => a.id)).toEqual(["a1"]);
  });

  it("classifica anúncio sem vínculo", async () => {
    anuncios = [anuncioBase({ id: "a1", produtoId: null, produto: null })];

    const resultado = await calcularSaudeAnuncios("conta-1");

    const grupo = resultado.grupos.find((g) => g.categoria === "SEM_VINCULO");
    expect(grupo?.anuncios.map((a) => a.id)).toEqual(["a1"]);
  });

  it("classifica anúncio sem tarifa calculada", async () => {
    anuncios = [anuncioBase({ id: "a1", mlTarifaVenda: null })];

    const resultado = await calcularSaudeAnuncios("conta-1");

    const grupo = resultado.grupos.find((g) => g.categoria === "SEM_TARIFA_FRETE");
    expect(grupo?.anuncios.map((a) => a.id)).toEqual(["a1"]);
  });

  it("classifica anúncio com frete grátis sem custo de frete sincronizado", async () => {
    anuncios = [anuncioBase({ id: "a1", mlFreeShipping: true, mlCustoFrete: null })];

    const resultado = await calcularSaudeAnuncios("conta-1");

    const grupo = resultado.grupos.find((g) => g.categoria === "SEM_TARIFA_FRETE");
    expect(grupo?.anuncios.map((a) => a.id)).toEqual(["a1"]);
  });

  it("classifica preço abaixo do custo quando a margem calculada é negativa", async () => {
    anuncios = [
      anuncioBase({
        id: "a1",
        mlPrice: 1000,
        mlTarifaVenda: 200,
        mlCustoFrete: 100,
        produto: { id: "p1", nome: "Produto 1", sku: "SKU1", isKit: false, custoMedio: 5000, componentes: [] },
      }),
    ];

    const resultado = await calcularSaudeAnuncios("conta-1");

    const grupo = resultado.grupos.find((g) => g.categoria === "PRECO_ABAIXO_CUSTO");
    expect(grupo?.anuncios.map((a) => a.id)).toEqual(["a1"]);
  });

  it("classifica Full baixo a partir da reposição real da conta", async () => {
    anuncios = [anuncioBase({ id: "a1", produtoId: "p1" })];
    calcularReposicaoContaMock.mockResolvedValue({
      sugestoes: [{ produtoId: "p1", temAnuncioFull: true, status: "critico" }],
      parcial: false,
    });

    const resultado = await calcularSaudeAnuncios("conta-1");

    const grupo = resultado.grupos.find((g) => g.categoria === "FULL_BAIXO");
    expect(grupo?.anuncios.map((a) => a.id)).toEqual(["a1"]);
  });

  it("não sinaliza Full baixo quando o status de reposição está ok", async () => {
    anuncios = [anuncioBase({ id: "a1", produtoId: "p1" })];
    calcularReposicaoContaMock.mockResolvedValue({
      sugestoes: [{ produtoId: "p1", temAnuncioFull: true, status: "ok" }],
      parcial: false,
    });

    const resultado = await calcularSaudeAnuncios("conta-1");

    expect(resultado.grupos.find((g) => g.categoria === "FULL_BAIXO")).toBeUndefined();
  });

  it("conta somente anúncios ativos em totalAtivos e não gera grupos quando está tudo saudável", async () => {
    anuncios = [anuncioBase({ id: "a1" }), anuncioBase({ id: "a2", mlStatus: "closed" })];

    const resultado = await calcularSaudeAnuncios("conta-1");

    expect(resultado.totalAtivos).toBe(1);
    expect(resultado.grupos).toEqual([]);
  });
});
