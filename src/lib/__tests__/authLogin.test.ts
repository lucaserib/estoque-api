import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

const prismaMock = vi.hoisted(() => ({ user: { findFirst: vi.fn() } }));
const limite = vi.hoisted(() => ({ checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 9, resetAt: 0 })) }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/rateLimit", () => limite);
vi.mock("@/modules/conta/criacao", () => ({ aoCriarConta: vi.fn() }));
vi.mock("@/modules/usuarios/equipe", () => ({ avisarConviteAceito: vi.fn() }));

import { authOptions, MENSAGEM_LOGIN_INVALIDO, MENSAGEM_MUITAS_TENTATIVAS, MENSAGEM_USUARIO_BLOQUEADO } from "../auth";

type Autorizar = (credenciais: Record<string, string>, req: { headers: Record<string, string> }) => Promise<unknown>;
const provedor = authOptions.providers.find((p) => p.id === "credentials") as unknown as { options: { authorize: Autorizar } };
const autorizar = (email: string, password: string) =>
  provedor.options.authorize({ email, password }, { headers: { "x-forwarded-for": "200.1.1.1" } });

describe("login com e-mail e senha", () => {
  beforeEach(() => vi.clearAllMocks());

  it("e-mail desconhecido, conta só Google e senha errada dão a mesma mensagem", async () => {
    const hash = await bcrypt.hash("senha-certa", 4);

    prismaMock.user.findFirst.mockResolvedValueOnce(null);
    await expect(autorizar("ninguem@loja.com", "x")).rejects.toThrow(MENSAGEM_LOGIN_INVALIDO);

    prismaMock.user.findFirst.mockResolvedValueOnce({ id: "u1", email: "g@loja.com", password: null, bloqueadoEm: null });
    await expect(autorizar("g@loja.com", "x")).rejects.toThrow(MENSAGEM_LOGIN_INVALIDO);

    prismaMock.user.findFirst.mockResolvedValueOnce({ id: "u2", email: "s@loja.com", password: hash, bloqueadoEm: null });
    await expect(autorizar("s@loja.com", "senha-errada")).rejects.toThrow(MENSAGEM_LOGIN_INVALIDO);
  });

  it("aplica limite por IP + e-mail", async () => {
    limite.checkRateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt: 0 });
    await expect(autorizar("Alguem@Loja.com", "x")).rejects.toThrow(MENSAGEM_MUITAS_TENTATIVAS);
    expect(limite.checkRateLimit).toHaveBeenCalledWith("login", "200.1.1.1:alguem@loja.com", 10, 900);
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
  });

  it("senha certa de usuário bloqueado não entra", async () => {
    const hash = await bcrypt.hash("senha-certa", 4);
    prismaMock.user.findFirst.mockResolvedValueOnce({ id: "u3", email: "b@loja.com", password: hash, bloqueadoEm: new Date() });
    await expect(autorizar("b@loja.com", "senha-certa")).rejects.toThrow(MENSAGEM_USUARIO_BLOQUEADO);
  });

  it("senha certa entra", async () => {
    const hash = await bcrypt.hash("senha-certa", 4);
    prismaMock.user.findFirst.mockResolvedValueOnce({ id: "u4", name: "Ana", email: "a@loja.com", password: hash, bloqueadoEm: null });
    await expect(autorizar("a@loja.com", "senha-certa")).resolves.toMatchObject({ id: "u4", email: "a@loja.com" });
  });
});
