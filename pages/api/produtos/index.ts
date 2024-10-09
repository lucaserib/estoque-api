// pages/api/produtos/index.ts
import { PrismaClient } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "POST") {
    try {
      const { nome, sku, produtos } = req.body;

      if (produtos && produtos.length > 0) {
        // Criar o produto (kit) primeiro
        const novoKit = await prisma.produto.create({
          data: {
            nome,
            sku,
            isKit: true,
          },
        });

        // Associar os produtos ao kit
        const kitProdutos = await prisma.kitProduto.createMany({
          data: produtos.map(
            (p: { produtoId: number; quantidade: number }) => ({
              kitId: novoKit.id,
              produtoId: p.produtoId,
              quantidade: p.quantidade,
            })
          ),
        });

        res.status(201).json({ ...novoKit, KitProduto: kitProdutos });
      } else {
        // Criar um produto
        const novoProduto = await prisma.produto.create({
          data: {
            nome,
            sku,
            isKit: false,
          },
        });
        res.status(201).json(novoProduto);
      }
    } catch (error) {
      console.error("Erro ao cadastrar produto ou kit:", error);
      res.status(500).json({ error: "Erro ao cadastrar produto ou kit" });
    }
  } else if (req.method === "GET") {
    try {
      const produtos = await prisma.produto.findMany({
        where: {
          isKit: false,
        },
      });
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

      // Remover referências antes de excluir o produto
      await prisma.pedidoProduto.deleteMany({
        where: { produtoId: Number(id) },
      });
      await prisma.estoque.deleteMany({ where: { produtoId: Number(id) } });
      await prisma.movimentacao.deleteMany({
        where: { produtoId: Number(id) },
      });

      await prisma.produto.delete({ where: { id: Number(id) } });
      res.status(204).end();
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erro ao deletar produto" });
    }
  } else {
    res.status(405).json({ error: "Método não permitido" });
  }
}
