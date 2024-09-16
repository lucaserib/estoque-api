import { PrismaClient } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "POST") {
    try {
      const { produtoId, tipo, quantidade } = req.body;

      if (!produtoId || !tipo || !quantidade) {
        return res
          .status(400)
          .json({ error: "Dados insuficientes para registrar movimentação." });
      }

      if (tipo !== "entrada" && tipo !== "saida") {
        return res
          .status(400)
          .json({ error: "Tipo de movimentação inválido." });
      }

      // Criar movimentação
      const novaMovimentacao = await prisma.movimentacao.create({
        data: { produtoId, tipo, quantidade },
      });

      // Atualizar quantidade no estoque
      const produto = await prisma.produto.findUnique({
        where: { id: Number(produtoId) },
      });

      if (!produto) {
        return res.status(404).json({ error: "Produto não encontrado." });
      }

      const novaQuantidade =
        tipo === "entrada"
          ? produto.quantidade + quantidade
          : produto.quantidade - quantidade;

      if (novaQuantidade < 0) {
        return res
          .status(400)
          .json({ error: "Quantidade insuficiente em estoque." });
      }

      await prisma.produto.update({
        where: { id: Number(produtoId) },
        data: { quantidade: novaQuantidade },
      });

      res.status(201).json(novaMovimentacao);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erro ao registrar movimentação." });
    }
  } else if (req.method === "GET") {
    try {
      const movimentacoes = await prisma.movimentacao.findMany();
      res.status(200).json(movimentacoes);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erro ao buscar movimentações." });
    }
  } else {
    res.status(405).json({ error: "Método não permitido." });
  }
}
