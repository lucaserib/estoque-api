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
      res.status(500).json({ message: "Erro ao criar estoque" });
    }
  } else if (req.method === "PUT") {
    try {
      const {
        id,
        armazemId,
        produtoId,
        quantidade,
        valorUnitario,
      }: {
        id: number;
        armazemId: number;
        produtoId: number;
        quantidade: number;
        valorUnitario: number;
      } = req.body;

      if (!id || !armazemId || !produtoId || !quantidade || !valorUnitario) {
        return res.status(400).json({
          message:
            "ID, armazém, produto, quantidade e valor unitário são obrigatórios",
        });
      }

      const estoque = await prisma.estoque.update({
        where: { id },
        data: {
          armazemId,
          produtoId,
          quantidade,
          valorUnitario,
        },
        include: { produto: true },
      });
      res.status(200).json(estoque);
    } catch (error) {
      res.status(500).json({ message: "Erro ao atualizar estoque" });
    }
  } else if (req.method === "DELETE") {
    try {
      const { id } = req.body;

      if (!id) {
        return res.status(400).json({ message: "ID do armazém é obrigatório" });
      }

      await prisma.armazem.delete({
        where: { id: Number(id) },
      });

      res.status(200).json({ message: "Armazém deletado com sucesso" });
    } catch (error) {
      res.status(500).json({ message: "Erro ao deletar armazém" });
    }
  } else {
    res.status(405).json({ message: "Método não permitido" });
  }
}
