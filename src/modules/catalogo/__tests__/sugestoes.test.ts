import { describe, it, expect, vi, beforeEach } from "vitest";

interface FakeAnuncio {
  id: string;
  userId: string;
  mlItemId: string;
  mlTitle: string;
  mlSellerSku: string | null;
  mlStatus: string;
  produtoId: string | null;
}

interface FakeProduto {
  id: string;
  userId: string;
  nome: string;
  sku: string;
  ativo: boolean;
  isKit: boolean;
}

let anuncios: FakeAnuncio[] = [];
let produtos: FakeProduto[] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    produtoMercadoLivre: {
      findMany: vi.fn(
        async ({ where }: { where: { mercadoLivreAccount: { userId: string }; produtoId: null; mlStatus: { in: string[] } } }) =>
          anuncios.filter(
            (a) =>
              a.userId === where.mercadoLivreAccount.userId &&
              a.produtoId === null &&
              where.mlStatus.in.includes(a.mlStatus)
          )
      ),
    },
    produto: {
      findMany: vi.fn(async ({ where }: { where: { userId: string; ativo: boolean } }) =>
        produtos.filter((p) => p.userId === where.userId && p.ativo === where.ativo)
      ),
    },
  },
}));

const { sugerirVinculos } = await import("../sugestoes");

beforeEach(() => {
  anuncios = [];
  produtos = [
    { id: "prod-1", userId: "conta-1", nome: "Adaptador USB-C", sku: "ADAPT-USBC", ativo: true, isKit: false },
    { id: "prod-2", userId: "conta-1", nome: "Cabo HDMI 2m", sku: "CABO-HDMI-2M", ativo: true, isKit: false },
  ];
});

describe("sugerirVinculos", () => {
  it("sugere por SKU exato (confiança alta) quando o SKU do anúncio bate com o do produto", async () => {
    anuncios = [
      {
        id: "an-1",
        userId: "conta-1",
        mlItemId: "MLB1",
        mlTitle: "Adaptador USB tipo C original",
        mlSellerSku: "adapt-usbc",
        mlStatus: "active",
        produtoId: null,
      },
    ];

    const sugestoes = await sugerirVinculos("conta-1");

    expect(sugestoes).toHaveLength(1);
    expect(sugestoes[0]).toMatchObject({ produtoId: "prod-1", confianca: "alta", unidadesSugeridas: 1 });
  });

  it("sugere por nome do produto dentro do título (confiança baixa) quando não há SKU batendo", async () => {
    anuncios = [
      {
        id: "an-2",
        userId: "conta-1",
        mlItemId: "MLB2",
        mlTitle: "Cabo HDMI 2m alta velocidade 4K",
        mlSellerSku: null,
        mlStatus: "active",
        produtoId: null,
      },
    ];

    const sugestoes = await sugerirVinculos("conta-1");

    expect(sugestoes).toHaveLength(1);
    expect(sugestoes[0]).toMatchObject({ produtoId: "prod-2", confianca: "baixa" });
  });

  it("detecta kit pelo título e sugere as unidades certas", async () => {
    anuncios = [
      {
        id: "an-3",
        userId: "conta-1",
        mlItemId: "MLB3",
        mlTitle: "Kit 3 Adaptador USB-C",
        mlSellerSku: "ADAPT-USBC",
        mlStatus: "active",
        produtoId: null,
      },
    ];

    const sugestoes = await sugerirVinculos("conta-1");

    expect(sugestoes[0]).toMatchObject({ produtoId: "prod-1", unidadesSugeridas: 3 });
  });

  it("não sugere nada quando não há SKU nem nome batendo", async () => {
    anuncios = [
      {
        id: "an-4",
        userId: "conta-1",
        mlItemId: "MLB4",
        mlTitle: "Produto completamente diferente",
        mlSellerSku: "SKU-DESCONHECIDO",
        mlStatus: "active",
        produtoId: null,
      },
    ];

    const sugestoes = await sugerirVinculos("conta-1");

    expect(sugestoes).toHaveLength(0);
  });

  it("não mistura sugestões de outra conta", async () => {
    anuncios = [
      {
        id: "an-5",
        userId: "conta-2",
        mlItemId: "MLB5",
        mlTitle: "Adaptador USB-C",
        mlSellerSku: "ADAPT-USBC",
        mlStatus: "active",
        produtoId: null,
      },
    ];

    const sugestoes = await sugerirVinculos("conta-1");

    expect(sugestoes).toHaveLength(0);
  });

  it("sugere kit do Bling pelo SKU, sem multiplicar unidades pelo título", async () => {
    produtos.push({ id: "kit-1", userId: "conta-1", nome: "Kit 3 Cabos", sku: "KIT-3-CABOS", ativo: true, isKit: true });
    anuncios = [
      {
        id: "an-k",
        userId: "conta-1",
        mlItemId: "MLBK",
        mlTitle: "Kit 3 Cabos HDMI 2m",
        mlSellerSku: "KIT-3-CABOS",
        mlStatus: "active",
        produtoId: null,
      },
    ];

    const sugestoes = await sugerirVinculos("conta-1");

    expect(sugestoes).toHaveLength(1);
    expect(sugestoes[0]).toMatchObject({ produtoId: "kit-1", confianca: "alta", unidadesSugeridas: 1 });
  });

  it("inclui anúncios pausados sem vínculo", async () => {
    anuncios = [
      {
        id: "an-p",
        userId: "conta-1",
        mlItemId: "MLBP",
        mlTitle: "Cabo HDMI 2m",
        mlSellerSku: "CABO-HDMI-2M",
        mlStatus: "paused",
        produtoId: null,
      },
    ];

    const sugestoes = await sugerirVinculos("conta-1");

    expect(sugestoes.map((s) => s.anuncioId)).toEqual(["an-p"]);
  });
});
