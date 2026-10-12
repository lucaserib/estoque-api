import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const atualizarContaFinanceiraMock = vi.fn();

class ContaFinanceiraNaoEncontradaError extends Error {}

vi.mock("@/modules/financeiro/lancamentos/contasFinanceiras", () => ({
  atualizarContaFinanceira: (...args: unknown[]) => atualizarContaFinanceiraMock(...args),
  ContaFinanceiraNaoEncontradaError,
}));

function criarRequestPatch(body: Record<string, unknown>) {
  return new Request("http://localhost/api/financeiro/contas-financeiras/cf-1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
function params() {
  return { params: Promise.resolve({ id: "cf-1" }) };
}

const { PATCH } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  atualizarContaFinanceiraMock.mockReset();
});

describe("PATCH /api/financeiro/contas-financeiras/[id]", () => {
  it("responde 403 sem FINANCEIRO_EDITAR", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "LEITURA" });
    const response = await PATCH(criarRequestPatch({ nome: "novo" }) as never, params());
    expect(response.status).toBe(403);
  });

  it("responde 404 quando a conta não existe", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    atualizarContaFinanceiraMock.mockRejectedValue(new ContaFinanceiraNaoEncontradaError());
    const response = await PATCH(criarRequestPatch({ nome: "novo" }) as never, params());
    expect(response.status).toBe(404);
  });

  it("atualiza a conta financeira, convertendo dataSaldoInicial para Date", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    atualizarContaFinanceiraMock.mockResolvedValue({ id: "cf-1", nome: "novo" });
    const response = await PATCH(
      criarRequestPatch({ nome: "novo", dataSaldoInicial: "2026-10-01" }) as never,
      params()
    );
    expect(response.status).toBe(200);
    const [, , dados] = atualizarContaFinanceiraMock.mock.calls[0];
    expect(dados.dataSaldoInicial).toBeInstanceOf(Date);
  });
});
