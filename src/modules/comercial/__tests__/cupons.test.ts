import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const prismaMock = vi.hoisted(() => ({
  cupom: { findUnique: vi.fn(), update: vi.fn() },
  usoCupom: { findUnique: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(async (operacoes: unknown[]) => Promise.all(operacoes as Promise<unknown>[])),
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { CupomInvalidoError, descontoDoCupom, registrarUsoCupom, validarCupom } from "../cupons";

const AGORA = new Date("2026-11-10T12:00:00.000Z");
const cupom = {
  id: "cup-1",
  codigo: "BEMVINDO",
  tipo: "PERCENTUAL",
  valor: 50,
  alvo: "PRIMEIRA_COBRANCA_MENSAL",
  usosMaximos: 100,
  usos: 3,
  validoAte: new Date("2026-12-31"),
  ativo: true,
};

describe("cupons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.cupom.findUnique.mockResolvedValue(cupom);
    prismaMock.usoCupom.findUnique.mockResolvedValue(null);
  });

  it("normaliza o código e calcula o desconto", async () => {
    const aplicavel = await validarCupom(" bemvindo ", "PRIMEIRA_COBRANCA_MENSAL", "conta-1", 1970, { agora: AGORA });
    expect(prismaMock.cupom.findUnique).toHaveBeenCalledWith({ where: { codigo: "BEMVINDO" } });
    expect(aplicavel).toMatchObject({ descontoCentavos: 985, precoFinalCentavos: 985 });
  });

  it("nunca deixa a cobrança abaixo de R$ 1,00", () => {
    expect(descontoDoCupom({ tipo: "FIXO", valor: 5000 }, 1970)).toBe(1870);
    expect(descontoDoCupom({ tipo: "PERCENTUAL", valor: 100 }, 3790)).toBe(3690);
  });

  it("recusa cupom inativo, de outro alvo, vencido ou esgotado", async () => {
    for (const parcial of [{ ativo: false }, { alvo: "ANUAL" }, { validoAte: new Date("2026-01-01") }, { usos: 100 }]) {
      prismaMock.cupom.findUnique.mockResolvedValueOnce({ ...cupom, ...parcial });
      await expect(validarCupom("BEMVINDO", "PRIMEIRA_COBRANCA_MENSAL", "conta-1", 1970, { agora: AGORA })).rejects.toBeInstanceOf(
        CupomInvalidoError
      );
    }
  });

  it("vale uma vez por conta, mas o mesmo checkout pode ser refeito", async () => {
    prismaMock.usoCupom.findUnique.mockResolvedValue({ cupomId: "cup-1", contaId: "conta-1", referencia: "sub-1" });
    await expect(
      validarCupom("BEMVINDO", "PRIMEIRA_COBRANCA_MENSAL", "conta-1", 1970, { agora: AGORA, referencia: "outra-compra" })
    ).rejects.toThrow("já usou");
    await expect(
      validarCupom("BEMVINDO", "PRIMEIRA_COBRANCA_MENSAL", "conta-1", 1970, { agora: AGORA, referencia: "sub-1" })
    ).resolves.toMatchObject({ precoFinalCentavos: 985 });
  });

  it("registrar o uso de novo pela mesma conta não conta duas vezes", async () => {
    prismaMock.usoCupom.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("único", { code: "P2002", clientVersion: "6.5.0" })
    );
    expect(await registrarUsoCupom("cup-1", "conta-1", "sub-1")).toBe(false);
  });
});
