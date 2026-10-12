import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const atualizarCategoriaMock = vi.fn();
const excluirCategoriaMock = vi.fn();

class CategoriaNaoEncontradaError extends Error {}
class CategoriaSistemaNaoPodeSerExcluidaError extends Error {}

vi.mock("@/modules/financeiro/lancamentos/categorias", () => ({
  atualizarCategoria: (...args: unknown[]) => atualizarCategoriaMock(...args),
  excluirCategoria: (...args: unknown[]) => excluirCategoriaMock(...args),
  CategoriaNaoEncontradaError,
  CategoriaSistemaNaoPodeSerExcluidaError,
}));

function criarRequestPatch(body: Record<string, unknown>) {
  return new Request("http://localhost/api/financeiro/categorias/cat-1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
function criarRequestDelete() {
  return new Request("http://localhost/api/financeiro/categorias/cat-1", { method: "DELETE" });
}
function params() {
  return { params: Promise.resolve({ id: "cat-1" }) };
}

const { PATCH, DELETE } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  atualizarCategoriaMock.mockReset();
  excluirCategoriaMock.mockReset();
});

describe("PATCH /api/financeiro/categorias/[id]", () => {
  it("responde 403 sem FINANCEIRO_EDITAR", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "LEITURA" });
    const response = await PATCH(criarRequestPatch({ nome: "novo" }) as never, params());
    expect(response.status).toBe(403);
  });

  it("responde 404 quando a categoria não existe", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    atualizarCategoriaMock.mockRejectedValue(new CategoriaNaoEncontradaError());
    const response = await PATCH(criarRequestPatch({ nome: "novo" }) as never, params());
    expect(response.status).toBe(404);
  });

  it("atualiza a categoria", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    atualizarCategoriaMock.mockResolvedValue({ id: "cat-1", nome: "novo" });
    const response = await PATCH(criarRequestPatch({ nome: "novo" }) as never, params());
    expect(response.status).toBe(200);
    expect(atualizarCategoriaMock).toHaveBeenCalledWith("conta-1", "cat-1", { nome: "novo" });
  });
});

describe("DELETE /api/financeiro/categorias/[id]", () => {
  it("responde 403 sem FINANCEIRO_EDITAR", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "LEITURA" });
    const response = await DELETE(criarRequestDelete() as never, params());
    expect(response.status).toBe(403);
  });

  it("responde 404 quando a categoria não existe", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    excluirCategoriaMock.mockRejectedValue(new CategoriaNaoEncontradaError());
    const response = await DELETE(criarRequestDelete() as never, params());
    expect(response.status).toBe(404);
  });

  it("responde 400 quando a categoria é do sistema", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    excluirCategoriaMock.mockRejectedValue(new CategoriaSistemaNaoPodeSerExcluidaError());
    const response = await DELETE(criarRequestDelete() as never, params());
    expect(response.status).toBe(400);
  });

  it("exclui a categoria", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    excluirCategoriaMock.mockResolvedValue(undefined);
    const response = await DELETE(criarRequestDelete() as never, params());
    expect(response.status).toBe(200);
  });
});
