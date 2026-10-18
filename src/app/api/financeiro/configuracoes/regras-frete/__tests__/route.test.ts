import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const findManyMock = vi.fn();
const upsertMock = vi.fn();
const deleteManyMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    regraFreteLogistica: {
      findMany: (...args: unknown[]) => findManyMock(...args),
      upsert: (...args: unknown[]) => upsertMock(...args),
      deleteMany: (...args: unknown[]) => deleteManyMock(...args),
    },
  },
}));

function criarRequestPost(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/financeiro/configuracoes/regras-frete", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
function criarRequestGet() {
  return new NextRequest("http://localhost/api/financeiro/configuracoes/regras-frete");
}
function criarRequestDelete(logistica: string) {
  return new NextRequest(
    `http://localhost/api/financeiro/configuracoes/regras-frete?logistica=${logistica}`,
    { method: "DELETE" }
  );
}

const { GET, POST, DELETE } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  findManyMock.mockReset();
  upsertMock.mockReset();
  deleteManyMock.mockReset();
});

describe("GET /api/financeiro/configuracoes/regras-frete", () => {
  it("responde 403 sem FINANCEIRO_VER", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "LEITURA" });
    const response = await GET(criarRequestGet());
    expect(response.status).toBe(403);
  });

  it("lista as regras da conta", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    findManyMock.mockResolvedValue([{ logistica: "drop_off" }]);

    const response = await GET(criarRequestGet());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([{ logistica: "drop_off" }]);
  });
});

describe("POST /api/financeiro/configuracoes/regras-frete", () => {
  it("responde 403 sem FINANCEIRO_EDITAR", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "LEITURA" });
    const response = await POST(criarRequestPost({ logistica: "drop_off", tipoValor: "FIXO", valorReais: 5 }));
    expect(response.status).toBe(403);
  });

  it("responde 400 sem logistica", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    const response = await POST(criarRequestPost({ tipoValor: "FIXO", valorReais: 5 }));
    expect(response.status).toBe(400);
  });

  it("responde 400 quando FIXO sem valorReais válido", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    const response = await POST(criarRequestPost({ logistica: "drop_off", tipoValor: "FIXO" }));
    expect(response.status).toBe(400);
  });

  it("responde 400 quando PERCENTUAL fora de 0-1", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    const response = await POST(
      criarRequestPost({ logistica: "drop_off", tipoValor: "PERCENTUAL", percentual: 1.5 })
    );
    expect(response.status).toBe(400);
  });

  it("converte valorReais para centavos ao salvar regra FIXO", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    upsertMock.mockResolvedValue({ logistica: "drop_off" });

    await POST(criarRequestPost({ logistica: "drop_off", tipoValor: "FIXO", valorReais: 4.5 }));

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_logistica: { userId: "conta-1", logistica: "drop_off" } },
        create: expect.objectContaining({ valor: 450, percentual: 0 }),
        update: expect.objectContaining({ valor: 450, percentual: 0 }),
      })
    );
  });

  it("salva regra PERCENTUAL sem converter o percentual", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    upsertMock.mockResolvedValue({ logistica: "me1" });

    await POST(criarRequestPost({ logistica: "me1", tipoValor: "PERCENTUAL", percentual: 0.08 }));

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ valor: 0, percentual: 0.08 }),
      })
    );
  });
});

describe("DELETE /api/financeiro/configuracoes/regras-frete", () => {
  it("responde 403 sem FINANCEIRO_EDITAR", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "LEITURA" });
    const response = await DELETE(criarRequestDelete("drop_off"));
    expect(response.status).toBe(403);
  });

  it("remove a regra da conta pela logística", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    deleteManyMock.mockResolvedValue({ count: 1 });

    const response = await DELETE(criarRequestDelete("drop_off"));

    expect(response.status).toBe(200);
    expect(deleteManyMock).toHaveBeenCalledWith({ where: { userId: "conta-1", logistica: "drop_off" } });
  });
});
