import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const listarMovimentosCarteiraMock = vi.fn();
vi.mock("@/modules/financeiro/canais/mercadoPago/movimentosCarteira", () => ({
  listarMovimentosCarteira: (...args: unknown[]) => listarMovimentosCarteiraMock(...args),
}));

const findFirstMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { mercadoLivreAccount: { findFirst: (...args: unknown[]) => findFirstMock(...args) } },
}));

function criarRequest(query: string) {
  return new Request(`http://localhost/api/financeiro/contas-financeiras/movimentos-carteira${query}`);
}

const { GET } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  listarMovimentosCarteiraMock.mockReset();
  findFirstMock.mockReset();
});

describe("GET /api/financeiro/contas-financeiras/movimentos-carteira", () => {
  it("responde 403 sem FINANCEIRO_VER", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "LEITURA" });
    const response = await GET(criarRequest("?desde=2026-05-01&ate=2026-05-31") as never);
    expect(response.status).toBe(403);
  });

  it("responde 400 sem desde/ate", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    const response = await GET(criarRequest("") as never);
    expect(response.status).toBe(400);
  });

  it("responde 404 sem conta ML ativa", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    findFirstMock.mockResolvedValue(null);
    const response = await GET(criarRequest("?desde=2026-05-01&ate=2026-05-31") as never);
    expect(response.status).toBe(404);
  });

  it("devolve os movimentos da carteira", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    findFirstMock.mockResolvedValue({ id: "conta-ml-1" });
    listarMovimentosCarteiraMock.mockResolvedValue({ movimentos: [], totalLiberacoes: 0 });

    const response = await GET(criarRequest("?desde=2026-05-01&ate=2026-05-31") as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.totalLiberacoes).toBe(0);
    expect(listarMovimentosCarteiraMock).toHaveBeenCalledWith(
      "conta-1", "conta-ml-1", expect.any(Date), expect.any(Date)
    );
  });
});
