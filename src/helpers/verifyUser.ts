import { getToken } from "next-auth/jwt";
import { prisma } from "../../lib/prisma";
import { NextRequest } from "next/server";

export async function verifyUser(req: NextRequest) {
  try {
    const isSecure = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
    const isFromNgrok =
      req.headers.get("host")?.includes(".ngrok") ||
      req.headers.get("host")?.includes(".ngrok.io") ||
      req.headers.get("host")?.includes(".ngrok-free.app");

    let token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
      secureCookie: isSecure,
      cookieName: isSecure ? "__Secure-next-auth.session-token" : "next-auth.session-token"
    });

    if (!token && isFromNgrok) {
      token = await getToken({
        req,
        secret: process.env.NEXTAUTH_SECRET,
        secureCookie: false,
        cookieName: "next-auth.session-token"
      });
    }

    if (!token) {
      console.error("Token não encontrado");
      throw new Error("Acesso não autorizado. Token ausente.");
    }

    if (!token.id) {
      console.error("Token sem ID de usuário");
      throw new Error("Acesso não autorizado. Token inválido (sem ID).");
    }

    const userId = token.id as string;

    try {
      let user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        if (!token.email) {
          console.error(
            "Não foi possível criar usuário: email não fornecido no token"
          );
          throw new Error("O email do usuário é necessário para o registro.");
        }

        user = await prisma.user.create({
          data: {
            id: userId,
            email: token.email,
            name: token.name || "Usuário",
          },
        });
      }

      return user;
    } catch (error) {
      console.error("Erro ao verificar ou criar usuário:", error);
      throw new Error("Erro ao verificar usuário.");
    }
  } catch (error) {
    console.error("Erro na verificação do token:", error);
    throw error;
  }
}
