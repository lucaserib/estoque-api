import { PrismaClient } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "GET") {
    try {
      const armazens = await prisma.armazem.findMany();
      res.status(200).json(armazens);
    } catch (error) {
      console.error("Erro ao buscar estoque:", error);
      res.status(500).json({ error: "Erro ao buscar estoque" });
    }
  } else if (req.method === "POST") {
    try {
      const {
        armazemId,
        produtoId,
        quantidade,
        valorUnitario,
      }: {
        armazemId: number;
        produtoId: number;
        quantidade: number;
        valorUnitario: number;
      } = req.body;

      if (!armazemId || !produtoId || !quantidade || !valorUnitario) {
        return res.status(400).json({
          message:
            "Armazém, produto, quantidade e valor unitário são obrigatórios",
        });
      }

      const estoque = await prisma.estoque.create({
        data: {
          armazemId,
          produtoId,
          quantidade,
          valorUnitario,
        },
        include: { produto: true },
      });
      res.status(201).json(estoque);
    } catch (error) {
      console.error("Erro ao criar estoque:", error);
      res.status(500).json({ message: "Erro ao criar estoque" });
    }
  } else if (req.method === "PUT") {
    try {
      const {
        armazemId,
        produtoId,
        quantidade,
        valorUnitario,
      }: {
        armazemId: number;
        produtoId: number;
        quantidade: number;
        valorUnitario: number;
      } = req.body;

      if (!armazemId || !produtoId || !quantidade || !valorUnitario) {
        return res.status(400).json({
          message:
            "Armazém, produto, quantidade e valor unitário são obrigatórios",
        });
      }

      const estoque = await prisma.estoque.update({
        where: {
          produtoId_armazemId: {
            produtoId,
            armazemId,
          },
        },
        data: {
          quantidade,
          valorUnitario,
        },
        include: { produto: true },
      });
      res.status(200).json(estoque);
    } catch (error) {
      console.error("Erro ao atualizar estoque:", error);
      res.status(500).json({ message: "Erro ao atualizar estoque" });
    }
  } else if (req.method === "DELETE") {
    try {
      const { armazemId, produtoId } = req.body;

      if (!armazemId) {
        return res.status(400).json({ message: "ID do armazém é obrigatório" });
      }

      // Caso tenha produtoId, deleta o estoque específico
      if (produtoId) {
        await prisma.estoque.delete({
          where: {
            produtoId_armazemId: {
              produtoId,
              armazemId,
            },
          },
        });
        res.status(200).json({ message: "Estoque deletado com sucesso" });
      } else {
        // Deleta o armazém se apenas o armazemId for fornecido
        await prisma.armazem.delete({
          where: {
            id: armazemId,
          },
        });
        res.status(200).json({ message: "Armazém deletado com sucesso" });
      }
    } catch (error) {
      console.error("Erro ao deletar armazém ou estoque:", error);
      res.status(500).json({ message: "Erro ao deletar armazém ou estoque" });
    }
  } else {
    res.status(405).json({ message: "Método não permitido" });
  }
}
