import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { User } from "@prisma/client";
import { obterSegredoAuth } from "@/lib/authSecret";
import { NaoAutenticadoError, UsuarioBloqueadoError } from "@/modules/conta/erros";

export interface VerifiedUser extends User {
  contaId: string;
}

export async function verifyUser(req: NextRequest): Promise<VerifiedUser> {
  const isSecure =
    req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  const isFromNgrok =
    req.headers.get("host")?.includes(".ngrok") ||
    req.headers.get("host")?.includes(".ngrok.io") ||
    req.headers.get("host")?.includes(".ngrok-free.app");

  let token = await getToken({
    req,
    secret: obterSegredoAuth(),
    secureCookie: isSecure,
    cookieName: isSecure ? "__Secure-next-auth.session-token" : "next-auth.session-token",
  });

  if (!token && isFromNgrok) {
    token = await getToken({
      req,
      secret: obterSegredoAuth(),
      secureCookie: false,
      cookieName: "next-auth.session-token",
    });
  }

  if (!token) {
    throw new NaoAutenticadoError("Acesso não autorizado. Token ausente.");
  }

  if (!token.id) {
    throw new NaoAutenticadoError("Acesso não autorizado. Token inválido (sem ID).");
  }

  const usuario = await prisma.user.findUnique({ where: { id: token.id as string } });

  if (!usuario) {
    throw new NaoAutenticadoError("Usuário não encontrado.");
  }

  if (usuario.bloqueadoEm || !sessaoAindaValida(token.emitidoEm, usuario.sessaoValidaDesde)) {
    throw new UsuarioBloqueadoError();
  }

  return { ...usuario, contaId: usuario.contaId ?? usuario.id };
}

export function sessaoAindaValida(emitidoEm: unknown, sessaoValidaDesde: Date | null): boolean {
  if (!sessaoValidaDesde) return true;
  return typeof emitidoEm === "number" && emitidoEm >= sessaoValidaDesde.getTime();
}
