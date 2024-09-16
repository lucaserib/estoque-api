import { PrismaClient } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "POST") {
    try {
      const { nome, sku, quantidade, fornecedorId } = req.body;
      const novoProduto = await prisma.produto.create({
        data: {
          nome,
          sku,
        },
      });
      res.status(201).json(novoProduto);
    } catch (error) {
      res.status(500).json({ error: "Erro ao cadastrar produto" });
    }
  } else if (req.method === "GET") {
    try {
      const produtos = await prisma.produto.findMany();
      res.status(200).json(produtos);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar produtos" });
    }
  } else if (req.method === "DELETE") {
    try {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ error: "ID do produto é obrigatório" });
      }
      await prisma.produto.delete({ where: { id: Number(id) } });
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ error: "Erro ao deletar produto" });
    }
  } else {
    res.status(405).json({ error: "Método não permitido" });
  }
}
