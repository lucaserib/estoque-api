import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const listarCategoriasMock = vi.fn();
const criarCategoriaMock = vi.fn();
vi.mock("@/modules/financeiro/lancamentos/categorias", () => ({
  listarCategorias: (...args: unknown[]) => listarCategoriasMock(...args),
  criarCategoria: (...args: unknown[]) => criarCategoriaMock(...args),
}));

function criarRequestGet(query = "") {
  return new NextRequest(`http://localhost/api/financeiro/categorias${query}`);
}
function criarRequestPost(body: Record<string, unknown>) {
  return new Request("http://localhost/api/financeiro/categorias", { method: "POST", body: JSON.stringify(body) });
}

const { GET, POST } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  listarCategoriasMock.mockReset();
  criarCategoriaMock.mockReset();
});

describe("GET /api/financeiro/categorias", () => {
  it("responde 403 sem FINANCEIRO_VER", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "LEITURA" });
    expect((await GET(criarRequestGet())).status).toBe(403);
  });

  it("lista as categorias da conta", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    listarCategoriasMock.mockResolvedValue([{ id: "cat-1" }]);
    const response = await GET(criarRequestGet());
    expect((await response.json()).categorias).toHaveLength(1);
  });
});

describe("POST /api/financeiro/categorias", () => {
  it("responde 403 sem FINANCEIRO_EDITAR", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "LEITURA" });
    const response = await POST(criarRequestPost({ nome: "x", grupoDre: "DESPESA_OPERACIONAL" }) as never);
    expect(response.status).toBe(403);
  });

  it("responde 400 sem nome/grupoDre", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    const response = await POST(criarRequestPost({}) as never);
    expect(response.status).toBe(400);
  });

  it("cria a categoria", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    criarCategoriaMock.mockResolvedValue({ id: "cat-1" });
    const response = await POST(criarRequestPost({ nome: "x", grupoDre: "DESPESA_OPERACIONAL" }) as never);
    expect(response.status).toBe(201);
  });
});
