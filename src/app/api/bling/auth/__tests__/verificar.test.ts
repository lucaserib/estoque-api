import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const verifyUser = vi.fn(async () => ({ id: "u1", contaId: "c1", role: "ADMIN" }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser }));
const prismaMock = { blingAccount: { findFirst: vi.fn(), update: vi.fn(async () => ({})) } };
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
const BlingService = { verificarEscopos: vi.fn(), getCompanyId: vi.fn() };
class BlingReconnectError extends Error {}
vi.mock("@/services/blingService", () => ({ BlingService, BlingReconnectError }));

const { POST } = await import("../route");
const pedido = (acao = "verificar") =>
  new NextRequest(`https://app.skubo.com.br/api/bling/auth?action=${acao}`, { method: "POST" });

beforeEach(() => vi.clearAllMocks());

describe("POST /api/bling/auth?action=verificar", () => {
  it("revalida as permissões sem reconectar e grava o id da empresa que faltava", async () => {
    prismaMock.blingAccount.findFirst.mockResolvedValue({ id: "b1", blingCompanyId: null });
    BlingService.verificarEscopos.mockResolvedValue([]);
    BlingService.getCompanyId.mockResolvedValue("empresa-9");

    const r = await POST(pedido());

    expect(await r.json()).toEqual({ escoposFaltando: [], empresaIdentificada: true });
    expect(prismaMock.blingAccount.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "c1", isActive: true } }));
    expect(prismaMock.blingAccount.update).toHaveBeenCalledWith({ where: { id: "b1" }, data: { blingCompanyId: "empresa-9" } });
  });

  it("devolve as permissões que faltam e não busca a empresa sem a permissão de dados básicos", async () => {
    prismaMock.blingAccount.findFirst.mockResolvedValue({ id: "b1", blingCompanyId: null });
    BlingService.verificarEscopos.mockResolvedValue(["Contatos (leitura)", "Dados básicos da empresa"]);
    const r = await POST(pedido());
    expect(await r.json()).toEqual({ escoposFaltando: ["Contatos (leitura)", "Dados básicos da empresa"], empresaIdentificada: false });
    expect(BlingService.getCompanyId).not.toHaveBeenCalled();
  });

  it("sem conta ativa pede para conectar e token sem volta pede para reconectar", async () => {
    prismaMock.blingAccount.findFirst.mockResolvedValueOnce(null);
    expect((await POST(pedido())).status).toBe(404);

    prismaMock.blingAccount.findFirst.mockResolvedValueOnce({ id: "b1", blingCompanyId: "x" });
    BlingService.verificarEscopos.mockRejectedValueOnce(new BlingReconnectError());
    const r = await POST(pedido());
    expect(r.status).toBe(409);
    expect((await r.json()).code).toBe("BLING_RECONECTAR");
  });

  it("só o papel com acesso a integrações pode verificar", async () => {
    verifyUser.mockResolvedValueOnce({ id: "u2", contaId: "c1", role: "VENDAS" });
    expect((await POST(pedido())).status).toBe(403);
    expect((await POST(pedido("outra"))).status).toBe(400);
  });
});
