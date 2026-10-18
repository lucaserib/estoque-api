import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const findManyMock = vi.fn();
const findFirstMock = vi.fn();
const updateMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    produtoMercadoLivre: {
      findMany: (...args: unknown[]) => findManyMock(...args),
      findFirst: (...args: unknown[]) => findFirstMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
    },
  },
}));

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
});

describe("GET /api/produtos/vinculos-pendentes", () => {
  it("responde 403 sem EDITAR_PRODUTO", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "VENDAS" });
    const response = await GET(criarRequestGet() as never);
    expect(response.status).toBe(403);
  });

  it("lista os vínculos não confirmados da conta", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    findManyMock.mockResolvedValue([
      { id: "v1", mlItemId: "MLB1", mlTitle: "Produto X", vinculoOrigem: "SIMILARIDADE", produto: { id: "p1", nome: "Produto 1", sku: "SKU-1" } },
    ]);

    const response = await GET(criarRequestGet() as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.vinculos).toHaveLength(1);
    expect(body.vinculos[0].origem).toBe("SIMILARIDADE");
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ vinculoConfirmado: false }),
      })
    );
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
    findFirstMock.mockResolvedValue(null);
    const response = await PATCH(criarRequestPatch({ id: "v1", acao: "confirmar" }) as never);
    expect(response.status).toBe(404);
  });

  it("confirmar marca vinculoConfirmado=true", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    findFirstMock.mockResolvedValue({ id: "v1" });

    await PATCH(criarRequestPatch({ id: "v1", acao: "confirmar" }) as never);

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "v1" },
      data: { vinculoConfirmado: true, syncStatus: "matched" },
    });
  });

  it("rejeitar desfaz o vínculo (produtoId null)", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    findFirstMock.mockResolvedValue({ id: "v1" });

    await PATCH(criarRequestPatch({ id: "v1", acao: "rejeitar" }) as never);

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "v1" },
      data: { produtoId: null, vinculoOrigem: null, vinculoConfirmado: true, syncStatus: "pending" },
    });
  });
});
