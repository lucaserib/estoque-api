import { PrismaClient } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "POST") {
    try {
      const { nome } = req.body;

      if (!nome) {
        return res.status(400).json({ error: "Nome do armazém é obrigatório" });
      }

      const armazem = await prisma.armazem.create({
        data: { nome },
      });

      res.status(201).json(armazem);
    } catch (error) {
      res.status(500).json({ error: "Erro ao criar armazém" });
    }
  } else if (req.method === "GET") {
    try {
      const armazens = await prisma.armazem.findMany();
      res.status(200).json(armazens);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar armazéns" });
    }
  } else {
    res.status(405).json({ message: "Método não permitido" });
  }
}
