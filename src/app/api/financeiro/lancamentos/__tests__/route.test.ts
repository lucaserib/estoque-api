import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const listarLancamentosMock = vi.fn();
const criarLancamentoMock = vi.fn();
vi.mock("@/modules/financeiro/lancamentos/servico", () => ({
  listarLancamentos: (...args: unknown[]) => listarLancamentosMock(...args),
  criarLancamento: (...args: unknown[]) => criarLancamentoMock(...args),
}));

function criarRequestGet(query: string) {
  return new NextRequest(`http://localhost/api/financeiro/lancamentos${query}`);
}
function criarRequestPost(body: Record<string, unknown>) {
  return new Request("http://localhost/api/financeiro/lancamentos", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const { GET, POST } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  listarLancamentosMock.mockReset();
  criarLancamentoMock.mockReset();
});

describe("GET /api/financeiro/lancamentos", () => {
  it("responde 403 sem FINANCEIRO_VER", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "LEITURA" });
    const response = await GET(criarRequestGet(""));
    expect(response.status).toBe(403);
  });

  it("passa os filtros de query para o serviço", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    listarLancamentosMock.mockResolvedValue([]);

    await GET(criarRequestGet("?status=PREVISTO&categoriaId=cat-1"));

    expect(listarLancamentosMock).toHaveBeenCalledWith(
      "conta-1",
      expect.objectContaining({ status: "PREVISTO", categoriaId: "cat-1" })
    );
  });
});

describe("POST /api/financeiro/lancamentos", () => {
  it("responde 403 sem FINANCEIRO_EDITAR", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", id: "user-1", role: "LEITURA" });

    const response = await POST(
      criarRequestPost({ descricao: "x", valor: 1, categoriaId: "c", competencia: "2026-05-01", vencimento: "2026-05-10" }) as never
    );
    expect(response.status).toBe(403);
  });

  it("responde 400 sem campos obrigatórios", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", id: "user-1", role: "ADMIN" });

    const response = await POST(criarRequestPost({ descricao: "x" }) as never);
    expect(response.status).toBe(400);
  });

  it("cria o lançamento com as datas convertidas", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", id: "user-1", role: "ADMIN" });
    criarLancamentoMock.mockResolvedValue({ id: "lanc-1" });

    const response = await POST(
      criarRequestPost({
        tipo: "DESPESA", descricao: "Aluguel", valor: 1000, categoriaId: "cat-1",
        competencia: "2026-05-01", vencimento: "2026-05-10",
      }) as never
    );

    expect(response.status).toBe(201);
    expect(criarLancamentoMock).toHaveBeenCalledWith(
      "conta-1", "user-1",
      expect.objectContaining({ competencia: new Date("2026-05-01"), vencimento: new Date("2026-05-10") })
    );
  });
});
