import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const accountFindFirstMock = vi.fn();
const produtoMlFindManyMock = vi.fn();
const vendaCanalItemFindManyMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    mercadoLivreAccount: { findFirst: (...args: unknown[]) => accountFindFirstMock(...args) },
    produtoMercadoLivre: { findMany: (...args: unknown[]) => produtoMlFindManyMock(...args) },
    vendaCanalItem: { findMany: (...args: unknown[]) => vendaCanalItemFindManyMock(...args) },
  },
}));

function criarRequest(query = "?accountId=conta-ml-1") {
  return new Request(`http://localhost/api/mercadolivre/produtos${query}`);
}

const { GET } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  accountFindFirstMock.mockReset();
  produtoMlFindManyMock.mockReset();
  vendaCanalItemFindManyMock.mockReset();
  verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
  accountFindFirstMock.mockResolvedValue({ id: "conta-ml-1", mlUserId: "999" });
});

describe("GET /api/mercadolivre/produtos", () => {
  it("responde 404 quando a conta não existe/está inativa", async () => {
    accountFindFirstMock.mockResolvedValue(null);
    const response = await GET(criarRequest() as never);
    expect(response.status).toBe(404);
  });

  it("Ciclo 11 (Fase 1): salesData vem de VendaCanalItem (centavos, sem recalcular float pela API)", async () => {
    produtoMlFindManyMock.mockResolvedValue([
      {
        id: "pml-1", mlItemId: "MLB1", mlTitle: "Produto 1", mlPrice: 3470, mlOriginalPrice: null,
        mlBasePrice: null, mlHasPromotion: false, mlPromotionDiscount: null, mlAvailableQuantity: 10,
        mlSoldQuantity: 5, mlStatus: "active", mlThumbnail: null, mlPermalink: null,
        lastSyncAt: new Date(), syncStatus: "synced", mlAutoStockPausado: false,
        produto: { id: "produto-1", nome: "Produto 1", sku: "SKU-1", estoques: [{ quantidade: 20 }] },
      },
    ]);
    vendaCanalItemFindManyMock.mockResolvedValue([
      { anuncioExternoId: "MLB1", quantidade: 2, precoUnitario: 3470, venda: { dataVenda: new Date() } },
    ]);

    const response = await GET(criarRequest() as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    const produto = body.products.find((p: { mlItemId: string }) => p.mlItemId === "MLB1");
    expect(produto.salesData.quantityThisMonth).toBe(2);
    expect(produto.salesData.revenueThisMonth).toBe(6940);
    expect(vendaCanalItemFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          venda: expect.objectContaining({ userId: "conta-1", canal: "MERCADO_LIVRE" }),
        }),
      })
    );
  });

  it("vendas de meses diferentes não se misturam (mês atual vs. anterior)", async () => {
    produtoMlFindManyMock.mockResolvedValue([
      {
        id: "pml-1", mlItemId: "MLB1", mlTitle: "Produto 1", mlPrice: 1000, mlOriginalPrice: null,
        mlBasePrice: null, mlHasPromotion: false, mlPromotionDiscount: null, mlAvailableQuantity: 10,
        mlSoldQuantity: 5, mlStatus: "active", mlThumbnail: null, mlPermalink: null,
        lastSyncAt: new Date(), syncStatus: "synced", mlAutoStockPausado: false,
        produto: { id: "produto-1", nome: "Produto 1", sku: "SKU-1", estoques: [] },
      },
    ]);
    const hoje = new Date();
    const mesPassado = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 15);
    vendaCanalItemFindManyMock.mockResolvedValue([
      { anuncioExternoId: "MLB1", quantidade: 1, precoUnitario: 1000, venda: { dataVenda: hoje } },
      { anuncioExternoId: "MLB1", quantidade: 3, precoUnitario: 1000, venda: { dataVenda: mesPassado } },
    ]);

    const response = await GET(criarRequest() as never);
    const body = await response.json();
    const produto = body.products.find((p: { mlItemId: string }) => p.mlItemId === "MLB1");

    expect(produto.salesData.quantityThisMonth).toBe(1);
    expect(produto.salesData.quantityPreviousMonth).toBe(3);
  });
});
