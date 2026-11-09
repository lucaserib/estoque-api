import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const prismaMock = { conversaIa: { deleteMany: vi.fn(async () => ({ count: 7 })) } };
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { GET } = await import("../route");

const ORIGINAL = { ...process.env };
beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "segredo";
  delete process.env.IA_RETENCAO_DIAS;
});
afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("cron ia-limpeza", () => {
  it("exige o CRON_SECRET", async () => {
    const r = await GET(new NextRequest("https://app/api/cron/ia-limpeza", { headers: { authorization: "Bearer errado" } }));
    expect(r.status).toBe(401);
    expect(prismaMock.conversaIa.deleteMany).not.toHaveBeenCalled();
  });

  it("apaga conversas paradas há mais que IA_RETENCAO_DIAS (padrão 90)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-20T12:00:00Z"));
    const r = await GET(new NextRequest("https://app/api/cron/ia-limpeza", { headers: { authorization: "Bearer segredo" } }));
    expect(await r.json()).toMatchObject({ apagadas: 7, retencaoDias: 90 });
    expect(prismaMock.conversaIa.deleteMany).toHaveBeenCalledWith({
      where: { updatedAt: { lt: new Date("2026-08-22T12:00:00Z") } },
    });
    process.env.IA_RETENCAO_DIAS = "30";
    await GET(new NextRequest("https://app/api/cron/ia-limpeza", { headers: { authorization: "Bearer segredo" } }));
    expect(prismaMock.conversaIa.deleteMany).toHaveBeenLastCalledWith({
      where: { updatedAt: { lt: new Date("2026-10-21T12:00:00Z") } },
    });
    vi.useRealTimers();
  });
});
