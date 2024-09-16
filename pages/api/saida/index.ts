import { PrismaClient } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "POST") {
    const {
      produtoId,
      quantidade,
      armazemId,
    }: { produtoId: number; quantidade: number; armazemId: number } = req.body;

    if (!produtoId || !quantidade || !armazemId) {
      return res.status(400).json({ error: "Dados incompletos" });
    }

    try {
      // Buscar o estoque para o produto no armazém específico
      const estoque = await prisma.estoque.findFirst({
        where: {
          produtoId,
          armazemId: armazemId,
        },
      });

      if (!estoque) {
        return res.status(404).json({ error: "Estoque não encontrado" });
      }

      if (estoque.quantidade < quantidade) {
        return res.status(400).json({ error: "Estoque insuficiente" });
      }

      // Atualizar a quantidade no estoque
      await prisma.estoque.update({
        where: { id: estoque.id },
        data: { quantidade: estoque.quantidade - quantidade },
      });

      // Registrar a movimentação de saída
      const movimentacao = await prisma.movimentacao.create({
        data: {
          tipo: "saida",
          quantidade,
          produtoId,
          armazemId,
          valorTotal: quantidade * estoque.valorUnitario, // Corrigido com o novo campo
        },
      });

      res.status(200).json(movimentacao);
    } catch (error) {
      res
        .status(500)
        .json({ error: "Erro ao registrar movimentação de saída" });
    }
  } else {
    res.status(405).json({ error: "Método não permitido" });
  }
}
