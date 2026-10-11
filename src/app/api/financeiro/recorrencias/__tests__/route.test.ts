import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const criarRecorrenciaMock = vi.fn();
vi.mock("@/modules/financeiro/lancamentos/recorrencias", () => ({
  criarRecorrencia: (...args: unknown[]) => criarRecorrenciaMock(...args),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    recorrenciaFinanceira: {
      findMany: vi.fn(async () => []),
    },
  },
}));

function criarRequestPost(body: Record<string, unknown>) {
  return new Request("http://localhost/api/financeiro/recorrencias", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const { GET, POST } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  criarRecorrenciaMock.mockReset();
});

describe("GET /api/financeiro/recorrencias", () => {
  it("responde 403 sem FINANCEIRO_VER", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "LEITURA" });
    const response = await GET(new NextRequest("http://localhost/api/financeiro/recorrencias"));
    expect(response.status).toBe(403);
  });

  it("devolve 200 para quem pode ver", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    const response = await GET(new NextRequest("http://localhost/api/financeiro/recorrencias"));
    expect(response.status).toBe(200);
  });
});

describe("POST /api/financeiro/recorrencias", () => {
  it("responde 400 sem campos obrigatórios", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    const response = await POST(criarRequestPost({ descricao: "Aluguel" }) as never);
    expect(response.status).toBe(400);
  });

  it("cria convertendo inicio/fim para Date", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    criarRecorrenciaMock.mockResolvedValue({ id: "rec-1" });

    const response = await POST(
      criarRequestPost({
        descricao: "Aluguel", valor: 1000, categoriaId: "cat-1", frequencia: "MENSAL",
        diaVencimento: 10, inicio: "2026-05-01",
      }) as never
    );

    expect(response.status).toBe(201);
    expect(criarRecorrenciaMock).toHaveBeenCalledWith(
      "conta-1",
      expect.objectContaining({ inicio: new Date("2026-05-01") })
    );
  });
});
