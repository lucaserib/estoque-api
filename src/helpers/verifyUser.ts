import { getToken } from "next-auth/jwt";
import { prisma } from "../../lib/prisma";
import { NextRequest } from "next/server";

export async function verifyUser(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token || !token.id) {
    throw new Error("Unauthorized");
  }

  const userId = token.id as string;

  // Tenta encontrar o usuário no banco de dados
  let user = await prisma.user.findUnique({
    where: { id: userId },
  });

  // Se o usuário não existir, cria um novo
  if (!user) {
    if (!token.email) {
      throw new Error("User email is required for registration");
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
}
