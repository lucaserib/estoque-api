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
        data: { nome, sku, quantidade, fornecedorId },
      });
      res.status(201).json(novoProduto);
    } catch (error) {
      res.status(500).json({ error: "Erro ao criar produto" });
    }
  } else if (req.method === "GET") {
    try {
      const produtos = await prisma.produto.findMany();
      res.status(200).json(produtos);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar produtos" });
    }
  } else if (req.method === "PUT") {
    try {
      const { id, nome, sku, quantidade, fornecedorId } = req.body;
      const produtoAtualizado = await prisma.produto.update({
        where: { id: Number(id) },
        data: { nome, sku, quantidade, fornecedorId },
      });
      res.status(200).json(produtoAtualizado);
    } catch (error) {
      res.status(500).json({ error: "Erro ao atualizar produto" });
    }
  } else if (req.method === "DELETE") {
    try {
      const { id } = req.body;
      await prisma.produto.delete({
        where: { id: Number(id) },
      });
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ error: "Erro ao remover produto" });
    }
  } else {
    res.status(405).json({ error: "Método não permitido" });
  }
}
