import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const conferirMesMock = vi.fn();
const corrigirMesMock = vi.fn();
vi.mock("@/modules/financeiro/relatorios/conferencia", () => ({
  conferirMes: (...args: unknown[]) => conferirMesMock(...args),
  corrigirMes: (...args: unknown[]) => corrigirMesMock(...args),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    mercadoLivreAccount: {
      findFirst: vi.fn(async ({ where }: { where: { userId: string; id?: string } }) => {
        if (where.userId !== "conta-dona") return null;
        if (where.id && where.id !== "conta-ml-1") return null;
        return { id: "conta-ml-1" };
      }),
    },
  },
}));

const { GET, POST } = await import("../route");

const get = (q: string) => new Request(`http://localhost/api/financeiro/conferencia${q}`);
const post = (body: Record<string, unknown>) =>
  new Request("http://localhost/api/financeiro/conferencia", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  verifyUserMock.mockReset();
  conferirMesMock.mockReset().mockResolvedValue({ confere: true });
  corrigirMesMock.mockReset().mockResolvedValue({ antes: {}, depois: { confere: true }, lote: { gravados: 3 } });
});

describe("GET /api/financeiro/conferencia", () => {
  it("403 sem FINANCEIRO_VER", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-dona", role: "VENDAS" });
    expect((await GET(get("?mes=2026-10") as never)).status).toBe(403);
  });

  it("400 com mês inválido", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-dona", role: "ADMIN" });
    expect((await GET(get("?mes=2026-13") as never)).status).toBe(400);
  });

  it("confere o mês da conta ativa", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-dona", role: "ADMIN" });
    const r = await GET(get("?mes=2026-10") as never);
    expect(r.status).toBe(200);
    expect(conferirMesMock).toHaveBeenCalledWith("conta-dona", "conta-ml-1", { ano: 2026, mes: 10 });
  });
});

describe("POST /api/financeiro/conferencia", () => {
  it("403 sem FINANCEIRO_EDITAR", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-dona", role: "LEITURA" });
    expect((await POST(post({ mes: "2026-10" }) as never)).status).toBe(403);
  });

  it("corrige o mês inteiro de uma vez", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-dona", role: "ADMIN" });
    const r = await POST(post({ mes: "2026-10" }) as never);
    expect(r.status).toBe(200);
    expect(corrigirMesMock).toHaveBeenCalledWith("conta-ml-1", { ano: 2026, mes: 10 });
    expect(await r.json()).toMatchObject({ lote: { gravados: 3 } });
  });
});
