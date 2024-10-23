import { PrismaClient } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "PUT") {
    try {
      const {
        produtoId,
        armazemId,
        estoqueSeguranca,
      }: { produtoId: number; armazemId: number; estoqueSeguranca: number } =
        req.body;

      if (!produtoId || !armazemId || estoqueSeguranca === undefined) {
        return res.status(400).json({
          message:
            "Produto ID, Armazém ID e estoque de segurança são obrigatórios",
        });
      }

      // Verificar se o registro existe
      const existingEstoque = await prisma.estoque.findUnique({
        where: { produtoId_armazemId: { produtoId, armazemId } },
      });

      if (!existingEstoque) {
        return res.status(404).json({ message: "Estoque não encontrado" });
      }

      const estoque = await prisma.estoque.update({
        where: { produtoId_armazemId: { produtoId, armazemId } },
        data: { estoqueSeguranca },
      });

      res.status(200).json(estoque);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Erro ao atualizar estoque de segurança" });
    }
  } else {
    res.status(405).json({ message: "Método não permitido" });
  }
}
