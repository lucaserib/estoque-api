// pages/api/estoque/[armazemId].ts
import { PrismaClient } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { armazemId } = req.query;

  if (req.method === "GET") {
    try {
      const estoque = await prisma.estoque.findMany({
        where: {
          armazemId: Number(armazemId),
        },
        include: {
          produto: true,
        },
      });

      res.status(200).json(estoque);
    } catch (error) {
      console.error("Erro ao buscar estoque:", error);
      res.status(500).json({ error: "Erro ao buscar estoque" });
    }
  } else {
    res.status(405).json({ error: "Método não permitido" });
  }
}