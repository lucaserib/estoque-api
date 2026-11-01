import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

const prismaMock = {
  produto: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  produtoMercadoLivre: { findFirst: vi.fn(), update: vi.fn() },
};
const revincularMock = vi.fn(async () => 3);

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/modules/financeiro/ingestao/sincronizador", () => ({
  revincularVendasDoAnuncio: (...args: unknown[]) => revincularMock(...(args as [])),
}));

const ANUNCIO = { id: "pml-1", mlItemId: "MLB123", mercadoLivreAccountId: "conta-ml" };
const ADAPTADOR = {
  id: "adp",
  nome: "Adaptador USB-C",
  sku: "ADP-USBC",
  isKit: false,
  imagemUrl: "https://img/adp.jpg",
  imagemThumbUrl: null,
  categoria: null,
  marca: null,
};

describe("definirVinculoAnuncio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.produtoMercadoLivre.findFirst.mockResolvedValue(ANUNCIO);
    prismaMock.produtoMercadoLivre.update.mockResolvedValue({});
  });

  it("anúncio de 1 unidade aponta direto para o produto e fica como vínculo manual", async () => {
    prismaMock.produto.findFirst.mockResolvedValue({ id: "adp" });
    const { definirVinculoAnuncio } = await import("../vinculos");

    const r = await definirVinculoAnuncio({ contaId: "c1", anuncioId: "pml-1", produtoId: "adp" });

    expect(r.produtoVinculadoId).toBe("adp");
    expect(r.kitCriado).toBe(false);
    expect(prismaMock.produtoMercadoLivre.update).toHaveBeenCalledWith({
      where: { id: "pml-1" },
      data: expect.objectContaining({ produtoId: "adp", vinculoOrigem: "MANUAL", vinculoConfirmado: true }),
    });
    expect(revincularMock).toHaveBeenCalledWith({
      userId: "c1",
      contaCanalId: "conta-ml",
      anuncioExternoId: "MLB123",
      produtoId: "adp",
    });
    expect(r.vendasRecalculadas).toBe(3);
  });

  it("kit com 2 do mesmo SKU: cria 'Kit 2x' com o adaptador × 2 e liga o anúncio ao kit", async () => {
    prismaMock.produto.findFirst
      .mockResolvedValueOnce({ id: "adp" }) // produto escolhido
      .mockResolvedValueOnce(ADAPTADOR); // base do kit
    prismaMock.produto.findMany.mockResolvedValue([]);
    prismaMock.produto.create.mockResolvedValue({ id: "kit-2" });
    const { definirVinculoAnuncio } = await import("../vinculos");

    const r = await definirVinculoAnuncio({ contaId: "c1", anuncioId: "pml-1", produtoId: "adp", unidadesPorVenda: 2 });

    expect(prismaMock.produto.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "c1",
        nome: "Kit 2x Adaptador USB-C",
        sku: "ADP-USBC-KIT2",
        isKit: true,
        componentes: { create: { produtoId: "adp", quantidade: 2 } },
      }),
      select: { id: true },
    });
    expect(r.produtoVinculadoId).toBe("kit-2");
    expect(r.kitCriado).toBe(true);
    expect(revincularMock).toHaveBeenCalledWith(expect.objectContaining({ produtoId: "kit-2" }));
  });

  it("reaproveita kit existente com o mesmo único componente e quantidade (inclusive vindo do Bling)", async () => {
    prismaMock.produto.findFirst.mockResolvedValueOnce({ id: "adp" }).mockResolvedValueOnce(ADAPTADOR);
    prismaMock.produto.findMany.mockResolvedValue([
      { id: "kit-misto", ativo: true, _count: { componentes: 2 } },
      { id: "kit-bling", ativo: true, _count: { componentes: 1 } },
    ]);
    const { definirVinculoAnuncio } = await import("../vinculos");

    const r = await definirVinculoAnuncio({ contaId: "c1", anuncioId: "pml-1", produtoId: "adp", unidadesPorVenda: 2 });

    expect(prismaMock.produto.create).not.toHaveBeenCalled();
    expect(r.produtoVinculadoId).toBe("kit-bling");
  });

  it("SKU do kit já usado por outro produto: tenta o próximo sufixo", async () => {
    prismaMock.produto.findFirst.mockResolvedValueOnce({ id: "adp" }).mockResolvedValueOnce(ADAPTADOR);
    prismaMock.produto.findMany.mockResolvedValue([]);
    prismaMock.produto.create
      .mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "6" }))
      .mockResolvedValueOnce({ id: "kit-2b" });
    const { definirVinculoAnuncio } = await import("../vinculos");

    await definirVinculoAnuncio({ contaId: "c1", anuncioId: "pml-1", produtoId: "adp", unidadesPorVenda: 2 });

    expect(prismaMock.produto.create.mock.calls[1][0].data.sku).toBe("ADP-USBC-KIT2-2");
  });

  it("não aceita kit como base de 'N unidades por venda'", async () => {
    prismaMock.produto.findFirst
      .mockResolvedValueOnce({ id: "kit" })
      .mockResolvedValueOnce({ ...ADAPTADOR, id: "kit", isKit: true });
    const { definirVinculoAnuncio } = await import("../vinculos");

    await expect(
      definirVinculoAnuncio({ contaId: "c1", anuncioId: "pml-1", produtoId: "kit", unidadesPorVenda: 3 })
    ).rejects.toThrow(/produto unitário/);
  });

  it("produtoId null desfaz o vínculo e tira o produto das vendas do anúncio", async () => {
    const { definirVinculoAnuncio } = await import("../vinculos");

    await definirVinculoAnuncio({ contaId: "c1", anuncioId: "pml-1", produtoId: null });

    expect(prismaMock.produtoMercadoLivre.update).toHaveBeenCalledWith({
      where: { id: "pml-1" },
      data: expect.objectContaining({ produtoId: null, syncStatus: "pending_link" }),
    });
    expect(revincularMock).toHaveBeenCalledWith(expect.objectContaining({ produtoId: null }));
  });

  it("anúncio de outra conta não é encontrado", async () => {
    prismaMock.produtoMercadoLivre.findFirst.mockResolvedValue(null);
    const { definirVinculoAnuncio } = await import("../vinculos");

    await expect(definirVinculoAnuncio({ contaId: "c1", anuncioId: "x", produtoId: "adp" })).rejects.toMatchObject({
      status: 404,
    });
  });

  it("unidades fora de 1..100 são recusadas", async () => {
    const { definirVinculoAnuncio } = await import("../vinculos");
    await expect(
      definirVinculoAnuncio({ contaId: "c1", anuncioId: "pml-1", produtoId: "adp", unidadesPorVenda: 0 })
    ).rejects.toThrow(/entre 1 e 100/);
  });
});

describe("descreverComposicao", () => {
  it("kit de um componente vira 'N unidades do produto base'", async () => {
    const { descreverComposicao } = await import("../vinculos");
    const c = descreverComposicao({
      id: "kit-2",
      nome: "Kit 2x Adaptador",
      sku: "ADP-KIT2",
      isKit: true,
      componentes: [{ quantidade: 2, produto: { id: "adp", nome: "Adaptador", sku: "ADP" } }],
    });
    expect(c).toMatchObject({ produtoBaseId: "adp", unidadesPorVenda: 2, ehKitDeQuantidade: true, ehKitMisto: false });
  });

  it("kit de vários produtos é kit misto, 1 por venda", async () => {
    const { descreverComposicao } = await import("../vinculos");
    const c = descreverComposicao({
      id: "k",
      nome: "Kit",
      sku: "K",
      isKit: true,
      componentes: [
        { quantidade: 1, produto: { id: "a", nome: "A", sku: "A" } },
        { quantidade: 1, produto: { id: "b", nome: "B", sku: "B" } },
      ],
    });
    expect(c).toMatchObject({ produtoBaseId: "k", unidadesPorVenda: 1, ehKitMisto: true });
  });
});
