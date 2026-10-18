import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const findFirstMock = vi.fn();
const updateMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    produto: {
      findFirst: (...args: unknown[]) => findFirstMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
    },
  },
}));

function criarRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/produtos/produto-1/custos-frete", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
function paramsPromise() {
  return { params: Promise.resolve({ id: "produto-1" }) };
}

const { PATCH } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  findFirstMock.mockReset();
  updateMock.mockReset();
});

describe("PATCH /api/produtos/[id]/custos-frete", () => {
  it("responde 403 sem EDITAR_PRODUTO", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "VENDAS" });
    const response = await PATCH(criarRequest({ custoFreteManual: 100 }) as never, paramsPromise());
    expect(response.status).toBe(403);
  });

  it("responde 404 quando o produto não existe na conta", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    findFirstMock.mockResolvedValue(null);

    const response = await PATCH(criarRequest({ custoFreteManual: 100 }) as never, paramsPromise());
    expect(response.status).toBe(404);
  });

  it("responde 400 para valor negativo", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    findFirstMock.mockResolvedValue({ id: "produto-1" });

    const response = await PATCH(criarRequest({ custoFreteManual: -5 }) as never, paramsPromise());
    expect(response.status).toBe(400);
  });

  it("atualiza apenas os campos enviados, sem tocar no restante do produto", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    findFirstMock.mockResolvedValue({ id: "produto-1" });
    updateMock.mockResolvedValue({ id: "produto-1", custoFreteManual: 300, custoEmbalagem: null });

    const response = await PATCH(criarRequest({ custoFreteManual: 300 }) as never, paramsPromise());

    expect(response.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "produto-1" },
      data: { custoFreteManual: 300 },
      select: { id: true, custoFreteManual: true, custoEmbalagem: true },
    });
  });

  it("permite limpar um custo enviando null explicitamente", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    findFirstMock.mockResolvedValue({ id: "produto-1" });
    updateMock.mockResolvedValue({ id: "produto-1", custoFreteManual: null, custoEmbalagem: 50 });

    await PATCH(criarRequest({ custoFreteManual: null, custoEmbalagem: 50 }) as never, paramsPromise());

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "produto-1" },
      data: { custoFreteManual: null, custoEmbalagem: 50 },
      select: { id: true, custoFreteManual: true, custoEmbalagem: true },
    });
  });
});
