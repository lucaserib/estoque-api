import { getToken } from "next-auth/jwt";
import { prisma } from "../../lib/prisma";
import { NextRequest } from "next/server";

export async function verifyUser(req: NextRequest) {
  try {
    console.log("Iniciando verificação de usuário");
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

    if (!token) {
      console.error("Token não encontrado");
      throw new Error("Acesso não autorizado. Token ausente.");
    }

    if (!token.id) {
      console.error("Token sem ID de usuário");
      throw new Error("Acesso não autorizado. Token inválido (sem ID).");
    }

    const userId = token.id as string;
    console.log("Token obtido para usuário ID:", userId);

    try {
      // Verifica se o usuário já existe no banco de dados
      let user = await prisma.user.findUnique({
        where: { id: userId },
      });

      // Se o usuário não existir, cria um novo
      if (!user) {
        console.log("Usuário não encontrado no banco, tentando criar");
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
        console.log("Usuário criado com sucesso:", user.id);
      } else {
        console.log("Usuário encontrado:", user.id);
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
