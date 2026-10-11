import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const atualizarLancamentoMock = vi.fn();
const excluirLancamentoMock = vi.fn();

vi.mock("@/modules/financeiro/lancamentos/servico", async () => {
  const actual = await vi.importActual<typeof import("@/modules/financeiro/lancamentos/servico")>(
    "@/modules/financeiro/lancamentos/servico"
  );
  return {
    ...actual,
    atualizarLancamento: (...args: unknown[]) => atualizarLancamentoMock(...args),
    excluirLancamento: (...args: unknown[]) => excluirLancamentoMock(...args),
  };
});

const { PATCH, DELETE } = await import("../route");

function criarRequest(method: string, body?: Record<string, unknown>) {
  return new Request("http://localhost/api/financeiro/lancamentos/lanc-1", {
    method,
    body: body ? JSON.stringify(body) : undefined,
  });
}
function paramsPromise() {
  return { params: Promise.resolve({ id: "lanc-1" }) };
}

beforeEach(() => {
  verifyUserMock.mockReset();
  atualizarLancamentoMock.mockReset();
  excluirLancamentoMock.mockReset();
});

describe("PATCH /api/financeiro/lancamentos/[id]", () => {
  it("responde 403 sem FINANCEIRO_EDITAR", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "LEITURA" });
    const response = await PATCH(criarRequest("PATCH", { valor: 1 }) as never, paramsPromise());
    expect(response.status).toBe(403);
  });

  it("responde 404 quando o lançamento não existe na conta", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    const { LancamentoNaoEncontradoError } = await import("@/modules/financeiro/lancamentos/servico");
    atualizarLancamentoMock.mockRejectedValue(new LancamentoNaoEncontradoError());

    const response = await PATCH(criarRequest("PATCH", { valor: 1 }) as never, paramsPromise());
    expect(response.status).toBe(404);
  });

  it("atualiza convertendo as datas presentes no corpo", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    atualizarLancamentoMock.mockResolvedValue({ id: "lanc-1" });

    await PATCH(criarRequest("PATCH", { vencimento: "2026-06-01" }) as never, paramsPromise());

    expect(atualizarLancamentoMock).toHaveBeenCalledWith(
      "conta-1", "lanc-1",
      expect.objectContaining({ vencimento: new Date("2026-06-01") })
    );
  });
});

describe("DELETE /api/financeiro/lancamentos/[id]", () => {
  it("responde 403 sem FINANCEIRO_EDITAR", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "LEITURA" });
    const response = await DELETE(criarRequest("DELETE") as never, paramsPromise());
    expect(response.status).toBe(403);
  });

  it("exclui normalmente", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    excluirLancamentoMock.mockResolvedValue(undefined);

    const response = await DELETE(criarRequest("DELETE") as never, paramsPromise());
    expect(response.status).toBe(200);
  });
});
