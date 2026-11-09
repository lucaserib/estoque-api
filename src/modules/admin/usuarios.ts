import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroAdmin } from "@/helpers/verifyAdminPlataforma";
import { invalidarSituacaoConta } from "@/modules/conta/situacao";
import { enviarConfirmacaoDeEmail, pedirRedefinicaoDeSenha } from "@/modules/usuarios/senha";
import type { ResultadoAcao } from "./acoesConta";

export async function buscarUsuarios(termo: string | null, limite = 100) {
  const busca = termo?.trim();
  const usuarios = await prisma.user.findMany({
    where: busca
      ? { OR: [{ email: { contains: busca, mode: "insensitive" } }, { name: { contains: busca, mode: "insensitive" } }, { id: busca }] }
      : {},
    orderBy: { createdAt: "desc" },
    take: limite,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      contaId: true,
      createdAt: true,
      emailVerificadoEm: true,
      bloqueadoEm: true,
      ultimoLoginEm: true,
      password: true,
      conta: { select: { id: true, email: true, perfilCliente: { select: { nomeLoja: true } } } },
      perfilCliente: { select: { nomeLoja: true } },
    },
  });
  return usuarios.map(({ password, conta, perfilCliente, ...u }) => ({
    ...u,
    dono: !u.contaId,
    contaId: u.contaId ?? u.id,
    loja: (conta?.perfilCliente ?? perfilCliente)?.nomeLoja ?? null,
    emailDono: conta?.email ?? u.email,
    entraCom: password ? "SENHA" : "GOOGLE",
  }));
}

export const acaoUsuarioSchema = z.object({
  acao: z.enum(["enviar-redefinicao", "reenviar-confirmacao", "bloquear", "desbloquear"]),
});

export async function executarAcaoUsuario(
  userId: string,
  acao: z.infer<typeof acaoUsuarioSchema>["acao"],
  contexto: { motivo: string; ip: string | null }
): Promise<ResultadoAcao> {
  const usuario = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, contaId: true, bloqueadoEm: true, emailVerificadoEm: true } });
  if (!usuario) throw new ErroAdmin("Usuário não encontrado", 404);
  const feito = (resultado: Record<string, unknown>, antes: unknown, depois: unknown): ResultadoAcao => ({
    resultado,
    auditoria: { acao: `USUARIO_${acao.toUpperCase().replace(/-/g, "_")}`, alvoTipo: "USUARIO", alvoId: userId, antes, depois },
  });

  if (acao === "enviar-redefinicao") {
    const enviado = await pedirRedefinicaoDeSenha(usuario.email, contexto.ip);
    if (!enviado) throw new ErroAdmin("Não foi possível enviar: usuário bloqueado.");
    return feito({ enviado: true }, null, { enviado: true });
  }
  if (acao === "reenviar-confirmacao") {
    if (usuario.emailVerificadoEm) throw new ErroAdmin("O e-mail deste usuário já está confirmado.");
    await enviarConfirmacaoDeEmail(usuario.id, contexto.ip);
    return feito({ enviado: true }, null, { enviado: true });
  }
  const agora = new Date();
  const bloquear = acao === "bloquear";
  await prisma.user.update({
    where: { id: userId },
    data: bloquear
      ? { bloqueadoEm: agora, motivoBloqueio: contexto.motivo.slice(0, 300), sessaoValidaDesde: agora }
      : { bloqueadoEm: null, motivoBloqueio: null },
  });
  invalidarSituacaoConta(usuario.contaId ?? usuario.id);
  return feito({ bloqueado: bloquear }, { bloqueadoEm: usuario.bloqueadoEm }, { bloqueadoEm: bloquear ? agora : null });
}
