import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const listarContasFinanceirasMock = vi.fn();
const criarContaFinanceiraMock = vi.fn();
vi.mock("@/modules/financeiro/lancamentos/contasFinanceiras", () => ({
  listarContasFinanceiras: (...args: unknown[]) => listarContasFinanceirasMock(...args),
  criarContaFinanceira: (...args: unknown[]) => criarContaFinanceiraMock(...args),
}));

function criarRequestGet(query = "") {
  return new NextRequest(`http://localhost/api/financeiro/contas-financeiras${query}`);
}
function criarRequestPost(body: Record<string, unknown>) {
  return new Request("http://localhost/api/financeiro/contas-financeiras", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const { GET, POST } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  listarContasFinanceirasMock.mockReset();
  criarContaFinanceiraMock.mockReset();
});

describe("GET /api/financeiro/contas-financeiras", () => {
  it("responde 403 sem FINANCEIRO_VER", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "LEITURA" });
    expect((await GET(criarRequestGet())).status).toBe(403);
  });

  it("lista as contas financeiras da conta", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    listarContasFinanceirasMock.mockResolvedValue([{ id: "cf-1" }]);
    const response = await GET(criarRequestGet());
    expect((await response.json()).contas).toHaveLength(1);
  });
});

describe("POST /api/financeiro/contas-financeiras", () => {
  const corpoValido = {
    nome: "Caixa",
    tipo: "CAIXA",
    saldoInicial: 1000,
    dataSaldoInicial: "2026-10-01",
  };

  it("responde 403 sem FINANCEIRO_EDITAR", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "LEITURA" });
    const response = await POST(criarRequestPost(corpoValido) as never);
    expect(response.status).toBe(403);
  });

  it("responde 400 sem campos obrigatórios", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    const response = await POST(criarRequestPost({}) as never);
    expect(response.status).toBe(400);
  });

  it("cria a conta financeira", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    criarContaFinanceiraMock.mockResolvedValue({ id: "cf-1" });
    const response = await POST(criarRequestPost(corpoValido) as never);
    expect(response.status).toBe(201);
    expect(criarContaFinanceiraMock).toHaveBeenCalledWith(
      "conta-1",
      expect.objectContaining({ nome: "Caixa", tipo: "CAIXA" })
    );
  });
});
