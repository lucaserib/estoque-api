import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { enviarEmailSemFalhar } from "@/modules/email/enviar";
import { linkAbsoluto } from "@/modules/email/config";
import { registrarEvento } from "@/modules/clientes/eventos";
import { invalidarSituacaoConta } from "@/modules/conta/situacao";
import { consumirTokenUsuario, gerarTokenUsuario } from "./tokens";
import { normalizarEmail } from "./convites";

export const SENHA_MINIMA = 8;

export class SenhaFracaError extends Error {
  readonly code = "SENHA_FRACA";

  constructor() {
    super(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`);
    this.name = "SenhaFracaError";
  }
}

export async function pedirRedefinicaoDeSenha(emailInformado: string, ip: string | null): Promise<boolean> {
  const email = normalizarEmail(emailInformado);
  const usuario = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, name: true, email: true, bloqueadoEm: true, contaId: true },
  });
  if (!usuario || usuario.bloqueadoEm) return false;

  const { token } = await gerarTokenUsuario(usuario.id, "REDEFINIR_SENHA", { ip });
  await enviarEmailSemFalhar({
    para: usuario.email,
    modelo: "redefinir-senha",
    dados: { nome: usuario.name, link: linkAbsoluto(`/redefinir-senha?token=${encodeURIComponent(token)}`) },
    chaveIdempotencia: `redefinir-senha:${usuario.id}:${token.slice(0, 16)}`,
    userId: usuario.id,
    contaId: usuario.contaId ?? usuario.id,
  });
  return true;
}

export async function redefinirSenha(token: string, novaSenha: string, agora: Date = new Date()): Promise<string> {
  if (novaSenha.length < SENHA_MINIMA) throw new SenhaFracaError();
  const userId = await consumirTokenUsuario(token, "REDEFINIR_SENHA", agora);
  const usuario = await prisma.user.findUnique({ where: { id: userId }, select: { emailVerificadoEm: true, contaId: true } });
  await prisma.user.update({
    where: { id: userId },
    data: {
      password: await bcrypt.hash(novaSenha, 10),
      sessaoValidaDesde: agora,
      emailVerificadoEm: usuario?.emailVerificadoEm ?? agora,
    },
  });
  invalidarSituacaoConta(usuario?.contaId ?? userId);
  return userId;
}

export async function enviarConfirmacaoDeEmail(userId: string, ip: string | null = null): Promise<boolean> {
  const usuario = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, emailVerificadoEm: true, contaId: true },
  });
  if (!usuario || usuario.emailVerificadoEm) return false;
  const { token } = await gerarTokenUsuario(usuario.id, "CONFIRMAR_EMAIL", { ip });
  await enviarEmailSemFalhar({
    para: usuario.email,
    modelo: "confirmar-email",
    dados: { nome: usuario.name, link: linkAbsoluto(`/confirmar-email?token=${encodeURIComponent(token)}`) },
    chaveIdempotencia: `confirmar-email:${usuario.id}:${token.slice(0, 16)}`,
    userId: usuario.id,
    contaId: usuario.contaId ?? usuario.id,
  });
  return true;
}

export async function confirmarEmail(token: string, agora: Date = new Date()): Promise<string> {
  const userId = await consumirTokenUsuario(token, "CONFIRMAR_EMAIL", agora);
  const usuario = await prisma.user.update({
    where: { id: userId },
    data: { emailVerificadoEm: agora },
    select: { id: true, contaId: true },
  });
  await registrarEvento(usuario.contaId ?? usuario.id, "EMAIL_VERIFICADO", { userId: usuario.id });
  return userId;
}
