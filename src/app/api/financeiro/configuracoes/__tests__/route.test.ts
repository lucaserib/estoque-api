import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

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

function criarRequestGet() {
  return new NextRequest("http://localhost/api/financeiro/configuracoes");
}
function criarRequestPatch(body: Record<string, unknown>) {
  return new Request("http://localhost/api/financeiro/configuracoes", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

const { GET, PATCH } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  findUniqueMock.mockReset();
  upsertMock.mockReset();
});

describe("GET /api/financeiro/configuracoes", () => {
  it("responde 403 sem FINANCEIRO_VER", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "LEITURA" });
    expect((await GET(criarRequestGet())).status).toBe(403);
  });

  it("devolve defaults quando não há configuração salva", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    findUniqueMock.mockResolvedValue(null);

    const resposta = await GET(criarRequestGet());
    const body = await resposta.json();

    expect(body.regimeTributario).toBe("SIMPLES");
    expect(body.aliquotaImposto).toBe(0);
    expect(body.usarRelatorioLiberacaoMercadoPago).toBe(false);
    expect(body.diasLiberacaoPadrao).toBe(14);
    expect(body.gerarContaAPagarAoConfirmarCompra).toBe(true);
    expect(body.prazoPagamentoPadraoDias).toBe(30);
    expect(body.blingContasAtivo).toBe(false);
  });
});

describe("PATCH /api/financeiro/configuracoes", () => {
  it("responde 403 sem FINANCEIRO_EDITAR", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "LEITURA" });
    const resposta = await PATCH(criarRequestPatch({ aliquotaImposto: 0.06 }) as never);
    expect(resposta.status).toBe(403);
  });

  it("responde 400 para aliquotaImposto fora do intervalo", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    const resposta = await PATCH(criarRequestPatch({ aliquotaImposto: 1.5 }) as never);
    expect(resposta.status).toBe(400);
  });

  it("responde 400 para regimeTributario inválido", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    const resposta = await PATCH(criarRequestPatch({ regimeTributario: "INVALIDO" }) as never);
    expect(resposta.status).toBe(400);
  });

  it("F4 (Ciclo 8): responde 400 para prazoPagamentoPadraoDias negativo", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    const resposta = await PATCH(criarRequestPatch({ prazoPagamentoPadraoDias: -1 }) as never);
    expect(resposta.status).toBe(400);
  });

  it("F4 (Ciclo 8): atualiza blingContasAtivo e prazoPagamentoPadraoDias via upsert", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    upsertMock.mockResolvedValue({ blingContasAtivo: true, prazoPagamentoPadraoDias: 45 });

    const resposta = await PATCH(
      criarRequestPatch({ blingContasAtivo: true, prazoPagamentoPadraoDias: 45 }) as never
    );

    expect(resposta.status).toBe(200);
    expect(upsertMock).toHaveBeenCalledWith({
      where: { userId: "conta-1" },
      update: { blingContasAtivo: true, prazoPagamentoPadraoDias: 45 },
      create: { userId: "conta-1", blingContasAtivo: true, prazoPagamentoPadraoDias: 45 },
    });
  });

  it("atualiza os campos informados via upsert", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    upsertMock.mockResolvedValue({ regimeTributario: "REAL", aliquotaImposto: 0.08 });

    const resposta = await PATCH(
      criarRequestPatch({ regimeTributario: "REAL", aliquotaImposto: 0.08 }) as never
    );

    expect(resposta.status).toBe(200);
    expect(upsertMock).toHaveBeenCalledWith({
      where: { userId: "conta-1" },
      update: { regimeTributario: "REAL", aliquotaImposto: 0.08 },
      create: { userId: "conta-1", regimeTributario: "REAL", aliquotaImposto: 0.08 },
    });
  });
});
