import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const findUniqueMock = vi.fn();
const upsertMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    configuracaoGeral: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      upsert: (...args: unknown[]) => upsertMock(...args),
    },
  },
}));

function criarRequestGET() {
  return new Request("http://localhost/api/configuracoes-gerais");
}

function criarRequestPATCH(body: Record<string, unknown>) {
  return new Request("http://localhost/api/configuracoes-gerais", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

const { GET, PATCH } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  findUniqueMock.mockReset();
  upsertMock.mockReset();
  verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
});

describe("GET /api/configuracoes-gerais", () => {
  it("usa 7 dias como padrão quando avgDeliveryDaysPadrao nunca foi configurado", async () => {
    findUniqueMock.mockResolvedValue(null);

    const response = await GET(criarRequestGET() as never);
    const body = await response.json();

    expect(body.avgDeliveryDaysPadrao).toBe(7);
  });

  it("retorna o valor configurado", async () => {
    findUniqueMock.mockResolvedValue({ aliquotaImposto: 0, nomeLoja: null, logoUrl: null, tema: "SISTEMA", avgDeliveryDaysPadrao: 15 });

    const response = await GET(criarRequestGET() as never);
    const body = await response.json();

    expect(body.avgDeliveryDaysPadrao).toBe(15);
  });
});

describe("PATCH /api/configuracoes-gerais", () => {
  it("rejeita avgDeliveryDaysPadrao fora do intervalo 1-365", async () => {
    const response = await PATCH(criarRequestPATCH({ avgDeliveryDaysPadrao: 0 }) as never);
    expect(response.status).toBe(400);
    expect(upsertMock).not.toHaveBeenCalled();

    const response2 = await PATCH(criarRequestPATCH({ avgDeliveryDaysPadrao: 400 }) as never);
    expect(response2.status).toBe(400);
  });

  it("rejeita valor não inteiro", async () => {
    const response = await PATCH(criarRequestPATCH({ avgDeliveryDaysPadrao: 7.5 }) as never);
    expect(response.status).toBe(400);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("grava avgDeliveryDaysPadrao válido", async () => {
    upsertMock.mockResolvedValue({ aliquotaImposto: 0, nomeLoja: null, logoUrl: null, tema: "SISTEMA", avgDeliveryDaysPadrao: 10 });

    const response = await PATCH(criarRequestPATCH({ avgDeliveryDaysPadrao: 10 }) as never);

    expect(response.status).toBe(200);
    const chamada = upsertMock.mock.calls[0][0];
    expect(chamada.update.avgDeliveryDaysPadrao).toBe(10);
  });
});
