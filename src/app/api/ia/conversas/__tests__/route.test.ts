import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const verifyUser = vi.fn();
vi.mock("@/helpers/verifyUser", () => ({ verifyUser }));
const prismaMock = {
  conversaIa: {
    deleteMany: vi.fn(async () => ({ count: 3 })),
    count: vi.fn(async () => 1),
    findMany: vi.fn(async () => [{ id: "c1", titulo: "T", createdAt: new Date(), updatedAt: new Date() }]),
  },
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { DELETE, GET } = await import("../route");

const pedido = (url: string, method = "GET") => new NextRequest(`https://app.skubo.com.br${url}`, { method });

beforeEach(() => vi.clearAllMocks());

describe("/api/ia/conversas", () => {
  it("lista só as conversas do próprio usuário dentro da conta", async () => {
    verifyUser.mockResolvedValue({ id: "membro", contaId: "dono" });
    const r = await GET(pedido("/api/ia/conversas"));
    expect(r.status).toBe(200);
    expect(prismaMock.conversaIa.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { autorId: "membro", userId: "dono", arquivadaEm: null } })
    );
  });

  it("só o dono apaga as conversas de toda a conta", async () => {
    verifyUser.mockResolvedValue({ id: "membro", contaId: "dono" });
    expect((await DELETE(pedido("/api/ia/conversas?escopo=conta", "DELETE"))).status).toBe(403);
    expect(prismaMock.conversaIa.deleteMany).not.toHaveBeenCalled();

    verifyUser.mockResolvedValue({ id: "dono", contaId: "dono" });
    const r = await DELETE(pedido("/api/ia/conversas?escopo=conta", "DELETE"));
    expect(await r.json()).toEqual({ apagadas: 3 });
    expect(prismaMock.conversaIa.deleteMany).toHaveBeenCalledWith({ where: { userId: "dono" } });
  });

  it("sem escopo explícito não apaga nada", async () => {
    verifyUser.mockResolvedValue({ id: "dono", contaId: "dono" });
    expect((await DELETE(pedido("/api/ia/conversas", "DELETE"))).status).toBe(400);
  });

  it("sem sessão devolve 401", async () => {
    verifyUser.mockRejectedValue(new Error("Acesso não autorizado. Token ausente."));
    expect((await GET(pedido("/api/ia/conversas"))).status).toBe(401);
  });
});
