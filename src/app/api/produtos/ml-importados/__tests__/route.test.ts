import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const findManyMock = vi.fn();
const findFirstMock = vi.fn();
const updateMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    produto: {
      findMany: (...args: unknown[]) => findManyMock(...args),
      findFirst: (...args: unknown[]) => findFirstMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
    },
  },
}));

function criarRequestGet() {
  return new Request("http://localhost/api/produtos/ml-importados");
}
function criarRequestPatch(body: Record<string, unknown>) {
  return new Request("http://localhost/api/produtos/ml-importados", {
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
  findManyMock.mockResolvedValue([]);
});

describe("GET /api/produtos/ml-importados", () => {
  it("responde 403 sem VER_CUSTO", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "VENDAS" });

    const response = await GET(criarRequestGet() as never);

    expect(response.status).toBe(403);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("responde 200 para ADMIN", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });

    const response = await GET(criarRequestGet() as never);

    expect(response.status).toBe(200);
  });
});

describe("PATCH /api/produtos/ml-importados", () => {
  it("responde 403 sem EDITAR_PRODUTO", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ESTOQUE" });

    const response = await PATCH(criarRequestPatch({ productId: "p1", updates: { custoMedio: 10 } }) as never);

    expect(response.status).toBe(403);
    expect(findFirstMock).not.toHaveBeenCalled();
  });
});
