import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

const prismaMock = vi.hoisted(() => ({
  tokenSenha: { findUnique: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
  user: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(async (operacoes: unknown[]) => operacoes),
}));
const email = vi.hoisted(() => ({ enviarEmailSemFalhar: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/modules/email/enviar", () => email);
vi.mock("@/modules/conta/situacao", () => ({ invalidarSituacaoConta: vi.fn() }));
vi.mock("@/modules/clientes/eventos", () => ({ registrarEvento: vi.fn() }));

import { hashDoToken, TokenInvalidoError } from "../tokens";
import { pedirRedefinicaoDeSenha, redefinirSenha, SenhaFracaError } from "../senha";

const AGORA = new Date("2026-11-10T12:00:00.000Z");

function token(parcial: Record<string, unknown> = {}) {
  return {
    id: "t1",
    userId: "u1",
    finalidade: "REDEFINIR_SENHA",
    tokenHash: hashDoToken("token-bruto-com-mais-de-vinte"),
    expiraEm: new Date(AGORA.getTime() + 30 * 60 * 1000),
    usadoEm: null,
    ...parcial,
  };
}

describe("redefinir senha", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tokenSenha.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.user.findUnique.mockResolvedValue({ emailVerificadoEm: null, contaId: null });
  });

  it("troca a senha, derruba as sessões antigas e marca o e-mail como verificado", async () => {
    prismaMock.tokenSenha.findUnique.mockResolvedValue(token());
    await redefinirSenha("token-bruto-com-mais-de-vinte", "nova-senha-123", AGORA);

    const chamada = prismaMock.user.update.mock.calls[0][0];
    expect(chamada.where).toEqual({ id: "u1" });
    expect(chamada.data.sessaoValidaDesde).toEqual(AGORA);
    expect(chamada.data.emailVerificadoEm).toEqual(AGORA);
    expect(await bcrypt.compare("nova-senha-123", chamada.data.password)).toBe(true);
    expect(prismaMock.tokenSenha.findUnique).toHaveBeenCalledWith({ where: { tokenHash: hashDoToken("token-bruto-com-mais-de-vinte") } });
  });

  it("link expirado não serve", async () => {
    prismaMock.tokenSenha.findUnique.mockResolvedValue(token({ expiraEm: new Date(AGORA.getTime() - 1) }));
    await expect(redefinirSenha("token-bruto-com-mais-de-vinte", "nova-senha-123", AGORA)).rejects.toMatchObject({ motivo: "EXPIRADO" });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("link já usado não serve, nem em corrida", async () => {
    prismaMock.tokenSenha.findUnique.mockResolvedValue(token({ usadoEm: AGORA }));
    await expect(redefinirSenha("token-bruto-com-mais-de-vinte", "nova-senha-123", AGORA)).rejects.toMatchObject({ motivo: "USADO" });

    prismaMock.tokenSenha.findUnique.mockResolvedValue(token());
    prismaMock.tokenSenha.updateMany.mockResolvedValue({ count: 0 });
    await expect(redefinirSenha("token-bruto-com-mais-de-vinte", "nova-senha-123", AGORA)).rejects.toBeInstanceOf(TokenInvalidoError);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("senha curta é recusada antes de gastar o link", async () => {
    await expect(redefinirSenha("token-bruto-com-mais-de-vinte", "curta", AGORA)).rejects.toBeInstanceOf(SenhaFracaError);
    expect(prismaMock.tokenSenha.findUnique).not.toHaveBeenCalled();
  });
});

describe("pedir redefinição", () => {
  beforeEach(() => vi.clearAllMocks());

  it("e-mail desconhecido não gera link nem e-mail", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    expect(await pedirRedefinicaoDeSenha("ninguem@loja.com", null)).toBe(false);
    expect(email.enviarEmailSemFalhar).not.toHaveBeenCalled();
  });

  it("guarda só o hash e manda o link por e-mail", async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: "u1", name: "Ana", email: "ana@loja.com", bloqueadoEm: null, contaId: null });
    expect(await pedirRedefinicaoDeSenha("ana@loja.com", "1.1.1.1")).toBe(true);
    const criado = prismaMock.tokenSenha.create.mock.calls[0][0].data;
    const enviado = email.enviarEmailSemFalhar.mock.calls[0][0];
    const tokenNoLink = decodeURIComponent(new URL(enviado.dados.link).searchParams.get("token")!);
    expect(criado.tokenHash).toBe(hashDoToken(tokenNoLink));
    expect(criado.tokenHash).not.toContain(tokenNoLink);
    expect(criado.expiraEm.getTime() - Date.now()).toBeLessThanOrEqual(60 * 60 * 1000);
  });
});
