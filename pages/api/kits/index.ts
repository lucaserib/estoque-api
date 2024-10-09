// pages/api/kits/index.ts
import { PrismaClient } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "GET") {
    try {
      const kits = await prisma.produto.findMany({
        where: {
          isKit: true,
        },
        include: {
          kits: {
            include: {
              produto: true,
            },
          },
        },
      });

      res.status(200).json(kits);
    } catch (error) {
      console.error("Erro ao buscar kits:", error);
      res.status(500).json({ error: "Erro ao buscar kits" });
    }
  } else {
    res.status(405).json({ error: "Método não permitido" });
  }
}
