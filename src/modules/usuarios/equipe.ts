import crypto from "node:crypto";
import type { Invitation, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { obterConfiguracaoComercial } from "@/modules/comercial/configuracao";
import { registrarEvento } from "@/modules/clientes/eventos";
import { garantirPerfilCliente } from "@/modules/clientes/perfil";
import { auditarConta } from "@/modules/conta/auditoria";
import { criarAssinaturaDaConta, invalidarSituacaoConta } from "@/modules/conta/situacao";
import { enviarEmailSemFalhar } from "@/modules/email/enviar";
import { linkAbsoluto } from "@/modules/email/config";
import { normalizarEmail, usuarioSemDadosProprios } from "./convites";

export const PAPEIS_VALIDOS: UserRole[] = ["ADMIN", "COMPRAS", "ESTOQUE", "VENDAS", "LEITURA"];
export const ROTULOS_PAPEIS: Record<UserRole, string> = {
  ADMIN: "Administrador",
  COMPRAS: "Compras",
  ESTOQUE: "Estoque",
  VENDAS: "Vendas",
  LEITURA: "Somente leitura",
};
export const DIAS_VALIDADE_CONVITE = 7;
export const MAX_CONVITES_PENDENTES = 20;
export const MAX_CONVITES_POR_HORA = 30;

export class EquipeError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 | 429 = 400
  ) {
    super(message);
    this.name = "EquipeError";
  }
}

interface Autor {
  id: string;
  contaId: string;
  name: string | null;
  email: string;
}

async function idsDaEquipe(contaId: string): Promise<string[]> {
  const membros = await prisma.user.findMany({
    where: { OR: [{ id: contaId }, { contaId }] },
    select: { id: true },
  });
  return membros.map((m) => m.id);
}

async function nomeDaLoja(contaId: string): Promise<string | null> {
  const [perfil, configuracao] = await Promise.all([
    prisma.perfilCliente.findUnique({ where: { contaId }, select: { nomeLoja: true } }),
    prisma.configuracaoGeral.findUnique({ where: { userId: contaId }, select: { nomeLoja: true } }),
  ]);
  return configuracao?.nomeLoja ?? perfil?.nomeLoja ?? null;
}

function novaValidade(agora: Date): Date {
  return new Date(agora.getTime() + DIAS_VALIDADE_CONVITE * 24 * 60 * 60 * 1000);
}

async function enviarEmailConvite(convite: Invitation, autor: Autor, contaId: string): Promise<void> {
  await enviarEmailSemFalhar({
    para: convite.email,
    modelo: "convite-equipe",
    dados: {
      nomeConvidante: autor.name,
      nomeLoja: await nomeDaLoja(contaId),
      papel: ROTULOS_PAPEIS[convite.role],
      link: linkAbsoluto(`/register?invite=${convite.token}`),
      expiraEm: convite.expiresAt,
    },
    chaveIdempotencia: `convite-equipe:${convite.id}:${convite.token.slice(0, 12)}`,
    contaId,
    userId: null,
  });
}

export async function criarConvite(
  autor: Autor,
  entrada: { email: string; role: UserRole },
  contexto: { ip?: string | null; agora?: Date } = {}
): Promise<{ convite: Invitation; usuarioJaCadastrado: boolean }> {
  const agora = contexto.agora ?? new Date();
  const email = normalizarEmail(entrada.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new EquipeError("E-mail inválido");
  if (!PAPEIS_VALIDOS.includes(entrada.role)) throw new EquipeError("Papel inválido");

  const limite = await checkRateLimit("convites", autor.id, MAX_CONVITES_POR_HORA, 3600);
  if (!limite.allowed) throw new EquipeError("Você mandou muitos convites em pouco tempo. Tente de novo em uma hora.", 429);

  const existente = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, contaId: true },
  });
  if (existente) {
    const contaDoExistente = existente.contaId ?? existente.id;
    if (contaDoExistente === autor.contaId) throw new EquipeError("Essa pessoa já faz parte da sua equipe");
    if (existente.contaId || !(await usuarioSemDadosProprios(existente.id))) {
      throw new EquipeError("Este e-mail já usa o Skubo com uma loja própria. Peça para a pessoa usar outro e-mail.");
    }
  }

  const equipe = await idsDaEquipe(autor.contaId);
  const pendentes = await prisma.invitation.count({
    where: { status: "PENDING", invitedById: { in: equipe }, expiresAt: { gt: agora }, email: { not: email } },
  });
  if (pendentes >= MAX_CONVITES_PENDENTES) {
    throw new EquipeError(`Sua loja já tem ${MAX_CONVITES_PENDENTES} convites esperando resposta. Revogue algum antes de mandar outro.`, 409);
  }

  const { limiteUsuariosPorConta } = await obterConfiguracaoComercial();
  if (limiteUsuariosPorConta !== null && equipe.length + pendentes >= limiteUsuariosPorConta) {
    throw new EquipeError(
      `Seu plano permite até ${limiteUsuariosPorConta} ${limiteUsuariosPorConta === 1 ? "usuário" : "usuários"} na loja, contando os convites pendentes.`,
      409
    );
  }

  await prisma.invitation.updateMany({
    where: { email: { equals: email, mode: "insensitive" }, status: "PENDING", invitedById: { in: equipe } },
    data: { status: "REVOKED" },
  });

  const convite = await prisma.invitation.create({
    data: {
      email,
      role: entrada.role,
      token: crypto.randomBytes(32).toString("hex"),
      expiresAt: novaValidade(agora),
      invitedById: autor.id,
    },
  });

  await enviarEmailConvite(convite, autor, autor.contaId);
  await auditarConta({
    contaId: autor.contaId,
    autorId: autor.id,
    acao: "CONVITE_ENVIADO",
    alvoTipo: "CONVITE",
    alvoId: convite.id,
    detalhe: { email, papel: entrada.role },
    ip: contexto.ip,
  });
  await registrarEvento(autor.contaId, "CONVITE_ENVIADO", { userId: autor.id, propriedades: { papel: entrada.role } });

  return { convite, usuarioJaCadastrado: Boolean(existente) };
}

async function conviteDaConta(conviteId: string, contaId: string): Promise<Invitation> {
  const convite = await prisma.invitation.findUnique({
    where: { id: conviteId },
    include: { invitedBy: { select: { id: true, contaId: true } } },
  });
  if (!convite || (convite.invitedBy.contaId ?? convite.invitedBy.id) !== contaId) {
    throw new EquipeError("Convite não encontrado", 404);
  }
  return convite;
}

export async function reenviarConvite(
  autor: Autor,
  conviteId: string,
  contexto: { ip?: string | null; agora?: Date } = {}
): Promise<Invitation> {
  const agora = contexto.agora ?? new Date();
  const convite = await conviteDaConta(conviteId, autor.contaId);
  if (convite.status !== "PENDING") throw new EquipeError("Este convite já foi usado ou revogado");

  const limite = await checkRateLimit("convites", autor.id, MAX_CONVITES_POR_HORA, 3600);
  if (!limite.allowed) throw new EquipeError("Você mandou muitos convites em pouco tempo. Tente de novo em uma hora.", 429);

  const renovado = await prisma.invitation.update({
    where: { id: convite.id },
    data: { token: crypto.randomBytes(32).toString("hex"), expiresAt: novaValidade(agora) },
  });
  await enviarEmailConvite(renovado, autor, autor.contaId);
  await auditarConta({
    contaId: autor.contaId,
    autorId: autor.id,
    acao: convite.expiresAt.getTime() <= agora.getTime() ? "CONVITE_RENOVADO" : "CONVITE_REENVIADO",
    alvoTipo: "CONVITE",
    alvoId: convite.id,
    detalhe: { email: convite.email },
    ip: contexto.ip,
  });
  return renovado;
}

export async function revogarConvite(autor: Autor, conviteId: string, contexto: { ip?: string | null } = {}): Promise<void> {
  const convite = await conviteDaConta(conviteId, autor.contaId);
  if (convite.status !== "PENDING") throw new EquipeError("Este convite já foi utilizado ou revogado");
  await prisma.invitation.update({ where: { id: convite.id }, data: { status: "REVOKED" } });
  await auditarConta({
    contaId: autor.contaId,
    autorId: autor.id,
    acao: "CONVITE_REVOGADO",
    alvoTipo: "CONVITE",
    alvoId: convite.id,
    detalhe: { email: convite.email },
    ip: contexto.ip,
  });
}

export async function avisarConviteAceito(conviteId: string, novoMembroId: string): Promise<void> {
  try {
    const convite = await prisma.invitation.findUnique({
      where: { id: conviteId },
      include: { invitedBy: { select: { id: true, email: true, contaId: true } } },
    });
    const membro = await prisma.user.findUnique({ where: { id: novoMembroId }, select: { name: true, email: true } });
    if (!convite || !membro) return;
    const contaId = convite.invitedBy.contaId ?? convite.invitedBy.id;

    await auditarConta({
      contaId,
      autorId: novoMembroId,
      acao: "CONVITE_ACEITO",
      alvoTipo: "USUARIO",
      alvoId: novoMembroId,
      detalhe: { email: membro.email, papel: convite.role },
    });
    await prisma.notification.create({
      data: {
        userId: convite.invitedBy.id,
        type: "EQUIPE",
        title: "Convite aceito",
        body: `${membro.name ?? membro.email} entrou na equipe como ${ROTULOS_PAPEIS[convite.role]}.`,
        link: "/usuarios",
      },
    });
    await enviarEmailSemFalhar({
      para: convite.invitedBy.email,
      modelo: "convite-aceito",
      dados: { nomeConvidado: membro.name, emailConvidado: membro.email, papel: ROTULOS_PAPEIS[convite.role] },
      chaveIdempotencia: `convite-aceito:${convite.id}`,
      userId: convite.invitedBy.id,
      contaId,
    });
  } catch (error) {
    console.error("[EQUIPE] Falha ao avisar o convite aceito:", error);
  }
}

async function desvincular(membroId: string, agora: Date): Promise<void> {
  await prisma.user.update({
    where: { id: membroId },
    data: { contaId: null, role: "ADMIN", sessaoValidaDesde: agora },
  });
  await criarAssinaturaDaConta(membroId, agora).catch((error) => console.error("[EQUIPE] Assinatura da nova conta:", error));
  await garantirPerfilCliente(membroId).catch((error) => console.error("[EQUIPE] Perfil da nova conta:", error));
  invalidarSituacaoConta(membroId);
}

export async function removerMembro(
  autor: Autor & { role: UserRole },
  membroId: string,
  contexto: { ip?: string | null; agora?: Date } = {}
): Promise<void> {
  const agora = contexto.agora ?? new Date();
  if (autor.role !== "ADMIN") throw new EquipeError("Só administradores podem remover pessoas da equipe", 403);
  if (membroId === autor.id) throw new EquipeError("Você não pode remover a si mesmo. Use \"Sair desta equipe\" no seu perfil.");
  if (membroId === autor.contaId) throw new EquipeError("O dono da conta não pode ser removido");

  const membro = await prisma.user.findUnique({ where: { id: membroId }, select: { id: true, name: true, email: true, contaId: true, role: true } });
  if (!membro || membro.contaId !== autor.contaId) throw new EquipeError("Usuário não encontrado", 404);

  await desvincular(membro.id, agora);
  await auditarConta({
    contaId: autor.contaId,
    autorId: autor.id,
    acao: "MEMBRO_REMOVIDO",
    alvoTipo: "USUARIO",
    alvoId: membro.id,
    detalhe: { email: membro.email, papel: membro.role },
    ip: contexto.ip,
  });
  await enviarEmailSemFalhar({
    para: membro.email,
    modelo: "membro-removido",
    dados: { nome: membro.name, nomeLoja: await nomeDaLoja(autor.contaId), saiuPorConta: false },
    chaveIdempotencia: `membro-removido:${autor.contaId}:${membro.id}:${agora.getTime()}`,
    userId: membro.id,
    contaId: membro.id,
  });
}

export async function sairDaEquipe(
  usuario: { id: string; contaId: string | null; name: string | null; email: string; role: UserRole },
  contexto: { ip?: string | null; agora?: Date } = {}
): Promise<void> {
  const agora = contexto.agora ?? new Date();
  const contaAnterior = usuario.contaId;
  if (!contaAnterior || contaAnterior === usuario.id) throw new EquipeError("Você é o dono desta conta e não pode sair dela");

  await desvincular(usuario.id, agora);
  await auditarConta({
    contaId: contaAnterior,
    autorId: usuario.id,
    acao: "MEMBRO_SAIU",
    alvoTipo: "USUARIO",
    alvoId: usuario.id,
    detalhe: { email: usuario.email, papel: usuario.role },
    ip: contexto.ip,
  });

  const administradores = await prisma.user.findMany({
    where: { OR: [{ id: contaAnterior }, { contaId: contaAnterior, role: "ADMIN" }] },
    select: { id: true },
  });
  await prisma.notification.createMany({
    data: administradores.map((admin) => ({
      userId: admin.id,
      type: "EQUIPE" as const,
      title: "Alguém saiu da equipe",
      body: `${usuario.name ?? usuario.email} saiu da equipe.`,
      link: "/usuarios",
    })),
  });
  await enviarEmailSemFalhar({
    para: usuario.email,
    modelo: "membro-removido",
    dados: { nome: usuario.name, nomeLoja: await nomeDaLoja(contaAnterior), saiuPorConta: true },
    chaveIdempotencia: `membro-saiu:${contaAnterior}:${usuario.id}:${agora.getTime()}`,
    userId: usuario.id,
    contaId: usuario.id,
  });
}
