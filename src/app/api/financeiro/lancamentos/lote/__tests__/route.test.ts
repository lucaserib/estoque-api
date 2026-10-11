import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const marcarComoPagoEmLoteMock = vi.fn();
const alterarCategoriaEmLoteMock = vi.fn();
const excluirPrevistosEmLoteMock = vi.fn();
vi.mock("@/modules/financeiro/lancamentos/servico", () => ({
  marcarComoPagoEmLote: (...args: unknown[]) => marcarComoPagoEmLoteMock(...args),
  alterarCategoriaEmLote: (...args: unknown[]) => alterarCategoriaEmLoteMock(...args),
  excluirPrevistosEmLote: (...args: unknown[]) => excluirPrevistosEmLoteMock(...args),
}));

function criarRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/financeiro/lancamentos/lote", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const { POST } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  marcarComoPagoEmLoteMock.mockReset();
  alterarCategoriaEmLoteMock.mockReset();
  excluirPrevistosEmLoteMock.mockReset();
});

describe("POST /api/financeiro/lancamentos/lote", () => {
  it("responde 403 sem FINANCEIRO_EDITAR", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "LEITURA" });
    const response = await POST(criarRequest({ acao: "marcar_pago", ids: ["a"] }) as never);
    expect(response.status).toBe(403);
  });

  it("responde 400 sem acao ou ids", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    const response = await POST(criarRequest({ acao: "marcar_pago" }) as never);
    expect(response.status).toBe(400);
  });

  it("marcar_pago chama o serviço certo", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    marcarComoPagoEmLoteMock.mockResolvedValue({ atualizados: 2 });

    const response = await POST(criarRequest({ acao: "marcar_pago", ids: ["a", "b"] }) as never);
    const body = await response.json();

    expect(body.atualizados).toBe(2);
    expect(marcarComoPagoEmLoteMock).toHaveBeenCalledWith("conta-1", ["a", "b"], undefined);
  });

  it("alterar_categoria exige categoriaId", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    const response = await POST(criarRequest({ acao: "alterar_categoria", ids: ["a"] }) as never);
    expect(response.status).toBe(400);
  });

  it("excluir_previstos chama o serviço certo", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    excluirPrevistosEmLoteMock.mockResolvedValue({ excluidos: 1 });

    const response = await POST(criarRequest({ acao: "excluir_previstos", ids: ["a"] }) as never);
    const body = await response.json();

    expect(body.excluidos).toBe(1);
  });

  it("acao desconhecida responde 400", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    const response = await POST(criarRequest({ acao: "voar", ids: ["a"] }) as never);
    expect(response.status).toBe(400);
  });
});
