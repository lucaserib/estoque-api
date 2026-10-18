import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const conferirMesMock = vi.fn();
const importarFaltantesMock = vi.fn();
const reprocessarDivergentesMock = vi.fn();
vi.mock("@/modules/financeiro/relatorios/conferencia", () => ({
  conferirMes: (...args: unknown[]) => conferirMesMock(...args),
  importarFaltantes: (...args: unknown[]) => importarFaltantesMock(...args),
  reprocessarDivergentes: (...args: unknown[]) => reprocessarDivergentesMock(...args),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mercadoLivreAccount: {
      findFirst: vi.fn(
        async ({ where }: { where: { userId: string; id?: string } }) => {
          if (where.userId !== "conta-dona") return null;
          if (where.id && where.id !== "conta-ml-1") return null;
          return { id: "conta-ml-1" };
        }
      ),
    },
  },
}));

function criarRequestGet(query: string) {
  return new Request(`http://localhost/api/financeiro/conferencia${query}`);
}
function criarRequestPost(body: Record<string, unknown>) {
  return new Request("http://localhost/api/financeiro/conferencia", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const { GET, POST } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  conferirMesMock.mockReset();
  importarFaltantesMock.mockReset();
  reprocessarDivergentesMock.mockReset();
});

describe("GET /api/financeiro/conferencia", () => {
  it("responde 403 para quem não é ADMIN", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-dona", role: "VENDAS" });
    const resposta = await GET(criarRequestGet("?mes=2026-05") as never);
    expect(resposta.status).toBe(403);
  });

  it("responde 400 sem o parâmetro mes", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-dona", role: "ADMIN" });
    const resposta = await GET(criarRequestGet("") as never);
    expect(resposta.status).toBe(400);
  });

  it("responde 404 sem conta ML ativa", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-sem-ml", role: "ADMIN" });
    const resposta = await GET(criarRequestGet("?mes=2026-05") as never);
    expect(resposta.status).toBe(404);
  });

  it("devolve o resultado da conferência", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-dona", role: "ADMIN" });
    conferirMesMock.mockResolvedValue({ coberturaPercentual: 100 });

    const resposta = await GET(criarRequestGet("?mes=2026-05") as never);
    const body = await resposta.json();

    expect(resposta.status).toBe(200);
    expect(body.coberturaPercentual).toBe(100);
    expect(conferirMesMock).toHaveBeenCalledWith("conta-dona", "conta-ml-1", { ano: 2026, mes: 5 });
  });
});

describe("POST /api/financeiro/conferencia", () => {
  it("responde 403 para quem não é ADMIN", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-dona", role: "ADMIN2" });
    const resposta = await POST(criarRequestPost({ pedidosExternoId: ["1"] }) as never);
    expect(resposta.status).toBe(403);
  });

  it("responde 400 sem pedidosExternoId", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-dona", role: "ADMIN" });
    const resposta = await POST(criarRequestPost({}) as never);
    expect(resposta.status).toBe(400);
  });

  it("acao padrão (ausente) importa faltantes", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-dona", role: "ADMIN" });
    importarFaltantesMock.mockResolvedValue({ importados: 2, erros: 0 });

    const resposta = await POST(criarRequestPost({ pedidosExternoId: ["1", "2"] }) as never);
    const body = await resposta.json();

    expect(body.importados).toBe(2);
    expect(importarFaltantesMock).toHaveBeenCalledWith("conta-ml-1", ["1", "2"]);
  });

  it("acao reprocessar_divergentes chama reprocessarDivergentes", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-dona", role: "ADMIN" });
    reprocessarDivergentesMock.mockResolvedValue({ reprocessados: 1, erros: 0 });

    const resposta = await POST(
      criarRequestPost({ pedidosExternoId: ["3"], acao: "reprocessar_divergentes" }) as never
    );
    const body = await resposta.json();

    expect(body.reprocessados).toBe(1);
    expect(reprocessarDivergentesMock).toHaveBeenCalledWith("conta-ml-1", ["3"]);
  });
});
