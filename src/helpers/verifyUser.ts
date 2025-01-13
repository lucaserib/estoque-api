import { getToken } from "next-auth/jwt";
import { prisma } from "../../lib/prisma";
import { NextRequest } from "next/server";

export async function verifyUser(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token || !token.id) {
    throw new Error("Acesso não autorizado. Token inválido ou ausente.");
  }

  const userId = token.id as string;

  try {
    // Verifica se o usuário já existe no banco de dados
    let user = await prisma.user.findUnique({
      where: { id: userId },
    });

    // Se o usuário não existir, cria um novo
    if (!user) {
      if (!token.email) {
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
    console.error("Erro ao verificar usuário:", error);
    throw new Error("Erro ao verificar usuário.");
  }
}
