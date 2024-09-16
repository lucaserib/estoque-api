// pages/api/fornecedores.ts
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
      const novoFornecedor = await prisma.fornecedor.create({
        data: { nome },
      });
      res.status(201).json(novoFornecedor);
    } catch (error) {
      res.status(500).json({ error: "Erro ao criar fornecedor" });
    }
  } else if (req.method === "GET") {
    try {
      const fornecedores = await prisma.fornecedor.findMany();
      res.status(200).json(fornecedores);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar fornecedores" });
    }
  } else if (req.method === "PUT") {
    try {
      const { id, nome } = req.body;
      const fornecedorAtualizado = await prisma.fornecedor.update({
        where: { id },
        data: { nome },
      });
      res.status(200).json(fornecedorAtualizado);
    } catch (error) {
      res.status(500).json({ error: "Erro ao atualizar fornecedor" });
    }
  } else if (req.method === "DELETE") {
    try {
      const { id } = req.body;
      await prisma.fornecedor.delete({
        where: { id },
      });
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ error: "Erro ao deletar fornecedor" });
    }
  } else {
    res.status(405).json({ error: "Método não permitido" });
  }
}
