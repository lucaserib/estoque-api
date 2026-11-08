import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = { mensagemIa: { count: vi.fn() }, usoIa: { count: vi.fn() } };
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/redis", () => ({ redis: null }));

const { limitarPerguntas, limitarExplicacoes } = await import("../limite");

beforeEach(() => vi.clearAllMocks());

describe("limite da IA sem Redis", () => {
  it("conta as perguntas do próprio usuário nos últimos 10 minutos no banco", async () => {
    const agora = new Date("2026-11-20T12:00:00Z").getTime();
    prismaMock.mensagemIa.count.mockResolvedValueOnce(19).mockResolvedValueOnce(20);
    expect((await limitarPerguntas("u1", agora)).allowed).toBe(true);
    expect((await limitarPerguntas("u1", agora)).allowed).toBe(false);
    expect(prismaMock.mensagemIa.count).toHaveBeenCalledWith({
      where: { papel: "USUARIO", createdAt: { gte: new Date("2026-11-20T11:50:00Z") }, conversa: { autorId: "u1" } },
    });
  });

  it("conta as explicações geradas pelo usuário (cache não conta)", async () => {
    prismaMock.usoIa.count.mockResolvedValueOnce(30);
    const r = await limitarExplicacoes("u1");
    expect(r).toMatchObject({ allowed: false, remaining: 0 });
    expect(prismaMock.usoIa.count.mock.calls[0][0].where).toMatchObject({ autorId: "u1", recurso: "EXPLICACAO" });
  });
});
