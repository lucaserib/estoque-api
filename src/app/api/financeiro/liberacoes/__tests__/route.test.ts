import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const conferirLiberacoesMock = vi.fn();
vi.mock("@/modules/financeiro/canais/mercadoPago/liberacoes", () => ({
  conferirLiberacoes: (...args: unknown[]) => conferirLiberacoesMock(...args),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mercadoLivreAccount: {
      findFirst: vi.fn(async ({ where }: { where: { userId: string } }) =>
        where.userId === "conta-1" ? { id: "conta-ml-1" } : null
      ),
    },
  },
}));

function criarRequest(query: string) {
  return new NextRequest(`http://localhost/api/financeiro/liberacoes${query}`);
}

const { GET } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  conferirLiberacoesMock.mockReset();
});

describe("GET /api/financeiro/liberacoes", () => {
  it("responde 400 sem desde/ate", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });

    const response = await GET(criarRequest(""));
    expect(response.status).toBe(400);
  });

  it("responde 404 sem conta ML ativa", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-sem-ml", role: "ADMIN" });

    const response = await GET(criarRequest("?desde=2026-05-01&ate=2026-05-31"));
    expect(response.status).toBe(404);
  });

  it("devolve habilitado=false quando a flag está desligada", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    conferirLiberacoesMock.mockResolvedValue({ habilitado: false, liberacoes: [] });

    const response = await GET(criarRequest("?desde=2026-05-01&ate=2026-05-31"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.habilitado).toBe(false);
  });
});
