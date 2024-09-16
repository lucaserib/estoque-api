import { PrismaClient } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "GET") {
    const { armazemId } = req.query;

    try {
      const estoque = await prisma.estoque.findMany({
        where: armazemId ? { armazemId: Number(armazemId) } : {},
        include: { produto: true },
      });

      res.status(200).json(estoque);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar estoque" });
    }
  } else {
    res.status(405).json({ message: "Método não permitido" });
  }
}
