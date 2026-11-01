import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const findManyMock = vi.fn();
const findFirstMock = vi.fn();
const updateMock = vi.fn();
const produtoFindFirstMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    produtoMercadoLivre: {
      findMany: (...args: unknown[]) => findManyMock(...args),
      findFirst: (...args: unknown[]) => findFirstMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
    },
    produto: {
      findFirst: (...args: unknown[]) => produtoFindFirstMock(...args),
    },
  },
}));

const { definirMock, confirmarMock } = vi.hoisted(() => ({ definirMock: vi.fn(), confirmarMock: vi.fn() }));
vi.mock("@/modules/catalogo/vinculos", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/modules/catalogo/vinculos")>();
  return {
    ...original,
    definirVinculoAnuncio: (...args: unknown[]) => definirMock(...args),
    confirmarVinculoAnuncio: (...args: unknown[]) => confirmarMock(...args),
  };
});
vi.mock("@/modules/financeiro/ingestao/sincronizador", () => ({ revincularVendasDoAnuncio: vi.fn() }));

function criarRequestGet() {
  return new Request("http://localhost/api/produtos/vinculos-pendentes");
}
function criarRequestPatch(body: Record<string, unknown>) {
  return new Request("http://localhost/api/produtos/vinculos-pendentes", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

const { GET, PATCH } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  findManyMock.mockReset();
  findFirstMock.mockReset();
  updateMock.mockReset();
  produtoFindFirstMock.mockReset();
  definirMock.mockReset();
  confirmarMock.mockReset();
});

describe("GET /api/produtos/vinculos-pendentes", () => {
  it("responde 403 sem EDITAR_PRODUTO", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "VENDAS" });
    const response = await GET(criarRequestGet() as never);
    expect(response.status).toBe(403);
  });

  it("lista vínculos não confirmados, com motivo NAO_CONFIRMADO", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    findManyMock.mockResolvedValue([
      {
        id: "v1", mlItemId: "MLB1", mlTitle: "Produto X", mlSellerSku: null,
        vinculoOrigem: "SIMILARIDADE", vinculoConfirmado: false,
        produto: { id: "p1", nome: "Produto 1", sku: "SKU-1" },
      },
    ]);

    const response = await GET(criarRequestGet() as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.vinculos).toHaveLength(1);
    expect(body.vinculos[0].motivos).toEqual(["NAO_CONFIRMADO"]);
  });

  it("Ciclo 11 (Fase 1): lista também vínculos confirmados cujo SKU do anúncio diverge do SKU do produto", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    findManyMock.mockResolvedValue([
      {
        id: "v2", mlItemId: "MLB4019629019", mlTitle: "Kit", mlSellerSku: "KITADAPPRE",
        vinculoOrigem: "SKU_EXATO", vinculoConfirmado: true,
        produto: { id: "p2", nome: "Kit Adaptador USB", sku: "KITADAPUSB" },
      },
    ]);

    const response = await GET(criarRequestGet() as never);
    const body = await response.json();

    expect(body.vinculos).toHaveLength(1);
    expect(body.vinculos[0].motivos).toEqual(["SKU_DIVERGENTE"]);
  });

  it("vínculo confirmado com SKU igual (normalizado) não entra na lista", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    findManyMock.mockResolvedValue([
      {
        id: "v3", mlItemId: "MLB1", mlTitle: "Produto", mlSellerSku: "sku-1",
        vinculoOrigem: "SKU_EXATO", vinculoConfirmado: true,
        produto: { id: "p1", nome: "Produto 1", sku: "SKU-1" },
      },
    ]);

    const response = await GET(criarRequestGet() as never);
    const body = await response.json();

    expect(body.vinculos).toHaveLength(0);
  });
});

describe("GET — kit de quantidade (Ciclo 12)", () => {
  it("anúncio de 'kit com 2' com o SKU do produto unitário não é SKU divergente", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    findManyMock.mockResolvedValue([
      {
        id: "v9", mlItemId: "MLB9", mlTitle: "Kit 2 Adaptadores", mlSellerSku: "ADP",
        vinculoOrigem: "MANUAL", vinculoConfirmado: true,
        produto: {
          id: "kit", nome: "Kit 2x Adaptador", sku: "ADP-KIT2", isKit: true,
          componentes: [{ quantidade: 2, produto: { id: "adp", nome: "Adaptador", sku: "ADP" } }],
        },
      },
    ]);
    const body = await (await GET(criarRequestGet() as never)).json();
    expect(body.vinculos).toHaveLength(0);
  });
});

describe("PATCH /api/produtos/vinculos-pendentes", () => {
  it("responde 403 sem EDITAR_PRODUTO", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "VENDAS" });
    const response = await PATCH(criarRequestPatch({ id: "v1", acao: "confirmar" }) as never);
    expect(response.status).toBe(403);
  });

  it("responde 404 quando o vínculo não existe na conta", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    const { VinculoErro } = await import("@/modules/catalogo/vinculos");
    confirmarMock.mockRejectedValue(new VinculoErro("Vínculo não encontrado", 404));
    const response = await PATCH(criarRequestPatch({ id: "v1", acao: "confirmar" }) as never);
    expect(response.status).toBe(404);
  });

  it("confirmar delega para o serviço de vínculos da conta", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    const response = await PATCH(criarRequestPatch({ id: "v1", acao: "confirmar" }) as never);
    expect(response.status).toBe(200);
    expect(confirmarMock).toHaveBeenCalledWith("conta-1", "v1");
  });

  it("rejeitar desfaz o vínculo (produtoId null)", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    await PATCH(criarRequestPatch({ id: "v1", acao: "rejeitar" }) as never);
    expect(definirMock).toHaveBeenCalledWith({ contaId: "conta-1", anuncioId: "v1", produtoId: null });
  });

  it("trocar vínculo em um clique, com unidades por venda (kit de quantidade)", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    const response = await PATCH(
      criarRequestPatch({ id: "v2", acao: "trocar", novoProdutoId: "produto-certo", unidadesPorVenda: 2 }) as never
    );
    expect(response.status).toBe(200);
    expect(definirMock).toHaveBeenCalledWith({
      contaId: "conta-1",
      anuncioId: "v2",
      produtoId: "produto-certo",
      unidadesPorVenda: 2,
    });
  });

  it("trocar sem novoProdutoId responde 400", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    const response = await PATCH(criarRequestPatch({ id: "v2", acao: "trocar" }) as never);
    expect(response.status).toBe(400);
  });

  it("trocar com produto inexistente na conta responde 404", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    const { VinculoErro } = await import("@/modules/catalogo/vinculos");
    definirMock.mockRejectedValue(new VinculoErro("Produto não encontrado", 404));
    const response = await PATCH(
      criarRequestPatch({ id: "v2", acao: "trocar", novoProdutoId: "nao-existe" }) as never
    );
    expect(response.status).toBe(404);
  });
});
