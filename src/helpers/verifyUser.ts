import { auth } from "@/lib/auth";
import { prisma } from "../../lib/prisma";

export async function verifyUser(req: Request) {
  const session = await auth(); // Obtém a sessão do usuário

  if (!session || !session.user?.id) {
    throw new Error("Unauthorized");
  }

  // Dados do usuário autenticado
  const { id, email, name } = session.user;

  // Tenta encontrar o usuário no banco de dados
  let user = await prisma.user.findUnique({
    where: { id },
  });

  // Se o usuário não existir, cria um novo
  if (!user) {
    if (!email) {
      throw new Error("User email is required for registration");
    }

    user = await prisma.user.create({
      data: {
        id, // ID fornecido pelo sistema de autenticação
        email,
        name: name || "Usuário", // Nome padrão, caso não exista
      },
    });
  }

  return user; // Retorna o usuário do banco de dados
}
