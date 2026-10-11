import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const atualizarRecorrenciaMock = vi.fn();
vi.mock("@/modules/financeiro/lancamentos/recorrencias", () => ({
  atualizarRecorrencia: (...args: unknown[]) => atualizarRecorrenciaMock(...args),
}));

function criarRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/financeiro/recorrencias/rec-1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
function paramsPromise() {
  return { params: Promise.resolve({ id: "rec-1" }) };
}

const { PATCH } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  atualizarRecorrenciaMock.mockReset();
});

describe("PATCH /api/financeiro/recorrencias/[id]", () => {
  it("responde 403 sem FINANCEIRO_EDITAR", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "LEITURA" });
    const response = await PATCH(criarRequest({ valor: 100 }) as never, paramsPromise());
    expect(response.status).toBe(403);
  });

  it("passa aplicarAosPrevistos para o serviço, default false", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });

    await PATCH(criarRequest({ valor: 100 }) as never, paramsPromise());

    expect(atualizarRecorrenciaMock).toHaveBeenCalledWith(
      "conta-1", "rec-1", expect.objectContaining({ valor: 100 }), false
    );
  });

  it("aplicarAosPrevistos=true é repassado", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });

    await PATCH(criarRequest({ valor: 100, aplicarAosPrevistos: true }) as never, paramsPromise());

    expect(atualizarRecorrenciaMock).toHaveBeenCalledWith(
      "conta-1", "rec-1", expect.objectContaining({ valor: 100 }), true
    );
  });

  it("converte fim string para Date quando presente", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });

    await PATCH(criarRequest({ fim: "2026-12-31" }) as never, paramsPromise());

    expect(atualizarRecorrenciaMock).toHaveBeenCalledWith(
      "conta-1", "rec-1", expect.objectContaining({ fim: new Date("2026-12-31") }), false
    );
  });
});
