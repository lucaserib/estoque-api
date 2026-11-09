import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), update: vi.fn() },
  consentimentoRegistro: { createMany: vi.fn() },
  supressaoEmail: { upsert: vi.fn(), deleteMany: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { aplicarDescadastro, gerarTokenDescadastro, lerTokenDescadastro } from "../descadastro";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.DESCADASTRO_SEGREDO = "segredo-de-teste";
});

describe("token de descadastro", () => {
  it("ida e volta, sem expiração", () => {
    const token = gerarTokenDescadastro("user-1", "MARKETING");
    expect(lerTokenDescadastro(token)).toEqual({ userId: "user-1", categoria: "MARKETING" });
  });

  it("token adulterado ou de outro segredo não vale", () => {
    const token = gerarTokenDescadastro("user-1", "CICLO_DE_VIDA");
    const [conteudo] = token.split(".");
    const outro = Buffer.from("user-2:TUDO").toString("base64url");
    expect(lerTokenDescadastro(`${outro}.${token.split(".")[1]}`)).toBeNull();
    expect(lerTokenDescadastro(`${conteudo}.xxxx`)).toBeNull();
    process.env.DESCADASTRO_SEGREDO = "outro";
    expect(lerTokenDescadastro(token)).toBeNull();
  });
});

describe("aplicar descadastro", () => {
  it("grava o consentimento negado (append-only) e suprime quando sai de tudo", async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ id: "u1", email: "Ana@Loja.com" })
      .mockResolvedValueOnce({ preferencias: { cicloDeVida: true, marketingEmail: true } });

    const estado = await aplicarDescadastro("u1", { cicloDeVida: false, marketing: false }, { origem: "descadastro" });

    expect(estado).toEqual({ cicloDeVida: false, marketing: false });
    expect(prismaMock.consentimentoRegistro.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ userId: "u1", tipo: "CICLO_DE_VIDA", concedido: false, origem: "descadastro" }),
        expect.objectContaining({ userId: "u1", tipo: "MARKETING_EMAIL", concedido: false }),
      ],
    });
    expect(prismaMock.supressaoEmail.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "ana@loja.com" }, create: expect.objectContaining({ motivo: "DESCADASTRO_TOTAL" }) })
    );
  });
});
