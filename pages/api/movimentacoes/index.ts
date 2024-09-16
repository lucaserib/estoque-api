import { PrismaClient } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "GET") {
    const { startDate, endDate }: { startDate?: string; endDate?: string } =
      req.query;

    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ error: "Datas de início e fim são obrigatórias" });
    }

    try {
      // Verificar se as datas são válidas
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ error: "Datas inválidas" });
      }

      // Buscar movimentações dentro do intervalo de datas
      const movimentacoes = await prisma.movimentacao.findMany({
        where: {
          data: {
            gte: start, // Maior ou igual a data de início
            lte: end, // Menor ou igual a data de fim
          },
        },
        include: {
          produto: true, // Incluir informações do produto
          fornecedor: true, // Incluir informações do fornecedor
        },
      });

      res.status(200).json(movimentacoes);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar movimentações" });
    }
  } else {
    res.status(405).json({ message: "Método não permitido" });
  }
}
