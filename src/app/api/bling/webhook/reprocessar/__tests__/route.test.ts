import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const blingAccountFindManyMock = vi.fn();
const blingWebhookEventFindManyMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    blingAccount: { findMany: (...args: unknown[]) => blingAccountFindManyMock(...args) },
    blingWebhookEvent: { findMany: (...args: unknown[]) => blingWebhookEventFindManyMock(...args) },
  },
}));

const processarEventoWebhookBlingMock = vi.fn();
vi.mock("@/services/blingWebhookProcessor", () => ({
  processarEventoWebhookBling: (...args: unknown[]) => processarEventoWebhookBlingMock(...args),
}));

function criarRequest() {
  return new Request("http://localhost/api/bling/webhook/reprocessar", { method: "POST" });
}

const { POST } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  blingAccountFindManyMock.mockReset();
  blingWebhookEventFindManyMock.mockReset();
  processarEventoWebhookBlingMock.mockReset();
});

describe("POST /api/bling/webhook/reprocessar", () => {
  it("responde 403 sem permissão de integrações", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "VENDAS" });
    const response = await POST(criarRequest() as never);
    expect(response.status).toBe(403);
  });

  it("sem conta Bling com companyId: 0 reprocessados, sem consultar eventos", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    blingAccountFindManyMock.mockResolvedValue([{ blingCompanyId: null }]);

    const response = await POST(criarRequest() as never);
    const body = await response.json();

    expect(body.reprocessados).toBe(0);
    expect(blingWebhookEventFindManyMock).not.toHaveBeenCalled();
  });

  it("reprocessa cada evento pendente da(s) empresa(s) ativa(s)", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    blingAccountFindManyMock.mockResolvedValue([{ blingCompanyId: "empresa-1" }]);
    blingWebhookEventFindManyMock.mockResolvedValue([{ id: "evt-1" }, { id: "evt-2" }]);

    const response = await POST(criarRequest() as never);
    const body = await response.json();

    expect(body.reprocessados).toBe(2);
    expect(processarEventoWebhookBlingMock).toHaveBeenCalledWith("evt-1");
    expect(processarEventoWebhookBlingMock).toHaveBeenCalledWith("evt-2");
    expect(blingWebhookEventFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: { in: ["empresa-1"] }, processado: false }),
      })
    );
  });
});
