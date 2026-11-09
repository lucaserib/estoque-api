import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), count: vi.fn() },
  invitation: { count: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
  notification: { createMany: vi.fn(), create: vi.fn() },
  perfilCliente: { findUnique: vi.fn(async () => null) },
  configuracaoGeral: { findUnique: vi.fn(async () => ({ nomeLoja: "Loja da Ana" })) },
}));
const email = vi.hoisted(() => ({ enviarEmailSemFalhar: vi.fn() }));
const auditoria = vi.hoisted(() => ({ auditarConta: vi.fn(), ipDe: vi.fn() }));
const comercial = vi.hoisted(() => ({
  obterConfiguracaoComercial: vi.fn(async (): Promise<{ limiteUsuariosPorConta: number | null }> => ({ limiteUsuariosPorConta: null })),
}));
const limite = vi.hoisted(() => ({ checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 1, resetAt: 0 })) }));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/modules/email/enviar", () => email);
vi.mock("@/modules/conta/auditoria", () => auditoria);
vi.mock("@/modules/comercial/configuracao", () => comercial);
vi.mock("@/lib/rateLimit", () => limite);
vi.mock("@/modules/conta/situacao", () => ({ criarAssinaturaDaConta: vi.fn(async () => ({})), invalidarSituacaoConta: vi.fn() }));
vi.mock("@/modules/clientes/perfil", () => ({ garantirPerfilCliente: vi.fn(async () => ({})) }));
vi.mock("@/modules/clientes/eventos", () => ({ registrarEvento: vi.fn() }));

import { EquipeError, criarConvite, removerMembro, sairDaEquipe } from "../equipe";

const admin = { id: "dono-1", contaId: "dono-1", name: "Ana", email: "ana@loja.com", role: "ADMIN" as const };

describe("remover membro", () => {
  beforeEach(() => vi.clearAllMocks());

  it("desvincula o membro, derruba a sessão, audita e avisa por e-mail", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "m1", name: "Bia", email: "bia@loja.com", contaId: "dono-1", role: "ESTOQUE" });
    const agora = new Date("2026-11-10T12:00:00.000Z");

    await removerMembro(admin, "m1", { agora });

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "m1" },
      data: { contaId: null, role: "ADMIN", sessaoValidaDesde: agora },
    });
    expect(auditoria.auditarConta).toHaveBeenCalledWith(expect.objectContaining({ contaId: "dono-1", acao: "MEMBRO_REMOVIDO", alvoId: "m1" }));
    expect(email.enviarEmailSemFalhar).toHaveBeenCalledWith(expect.objectContaining({ para: "bia@loja.com", modelo: "membro-removido" }));
  });

  it("não remove o dono, a si mesmo, membro de outra conta nem deixa não-admin remover", async () => {
    await expect(removerMembro(admin, "dono-1")).rejects.toThrow(EquipeError);
    await expect(removerMembro({ ...admin, id: "admin-2" }, "dono-1")).rejects.toThrow("dono");
    await expect(removerMembro({ ...admin, role: "COMPRAS" }, "m1")).rejects.toMatchObject({ status: 403 });
    prismaMock.user.findUnique.mockResolvedValue({ id: "m9", contaId: "outra-conta", email: "x@y.com" });
    await expect(removerMembro(admin, "m9")).rejects.toMatchObject({ status: 404 });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});

describe("sair da equipe", () => {
  beforeEach(() => vi.clearAllMocks());

  it("membro sai, administradores são avisados", async () => {
    prismaMock.user.findMany.mockResolvedValue([{ id: "dono-1" }]);
    await sairDaEquipe({ id: "m1", contaId: "dono-1", name: "Bia", email: "bia@loja.com", role: "VENDAS" });
    expect(prismaMock.user.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "m1" } }));
    expect(prismaMock.notification.createMany).toHaveBeenCalled();
    expect(auditoria.auditarConta).toHaveBeenCalledWith(expect.objectContaining({ acao: "MEMBRO_SAIU", contaId: "dono-1" }));
  });

  it("dono não pode sair da própria conta", async () => {
    await expect(sairDaEquipe({ id: "dono-1", contaId: null, name: null, email: "a@b.com", role: "ADMIN" })).rejects.toThrow(EquipeError);
  });
});

describe("convites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.user.findMany.mockResolvedValue([{ id: "dono-1" }, { id: "m1" }]);
    prismaMock.invitation.create.mockImplementation(async ({ data }) => ({ id: "conv-1", ...data }));
  });

  it("envia o convite por e-mail e audita", async () => {
    prismaMock.invitation.count.mockResolvedValue(0);
    const { convite } = await criarConvite(admin, { email: "Novo@Loja.com", role: "COMPRAS" });
    expect(convite.email).toBe("novo@loja.com");
    expect(email.enviarEmailSemFalhar).toHaveBeenCalledWith(expect.objectContaining({ para: "novo@loja.com", modelo: "convite-equipe" }));
    expect(auditoria.auditarConta).toHaveBeenCalledWith(expect.objectContaining({ acao: "CONVITE_ENVIADO" }));
  });

  it("recusa com 409 acima de 20 convites pendentes", async () => {
    prismaMock.invitation.count.mockResolvedValue(20);
    await expect(criarConvite(admin, { email: "x@loja.com", role: "COMPRAS" })).rejects.toMatchObject({ status: 409 });
  });

  it("respeita o limite de usuários por conta da configuração", async () => {
    prismaMock.invitation.count.mockResolvedValue(1);
    comercial.obterConfiguracaoComercial.mockResolvedValueOnce({ limiteUsuariosPorConta: 3 });
    await expect(criarConvite(admin, { email: "x@loja.com", role: "COMPRAS" })).rejects.toMatchObject({ status: 409 });
  });

  it("limita 30 convites por hora por usuário", async () => {
    limite.checkRateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt: 0 });
    await expect(criarConvite(admin, { email: "x@loja.com", role: "COMPRAS" })).rejects.toMatchObject({ status: 429 });
    expect(limite.checkRateLimit).toHaveBeenCalledWith("convites", "dono-1", 30, 3600);
  });
});
