// pages/api/saida/index.ts

import { PrismaClient } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "POST") {
    try {
      const { produtos, armazemId } = req.body;

      if (!produtos || produtos.length === 0 || !armazemId) {
        return res
          .status(400)
          .json({ error: "Produtos e armazém são obrigatórios" });
      }

      for (const { produtoId, quantidade, isKit } of produtos) {
        if (isKit) {
          const kitProdutos = await prisma.kitProduto.findMany({
            where: { kitId: produtoId },
            include: { produto: true },
          });

          for (const kitProduto of kitProdutos) {
            const estoque = await prisma.estoque.findFirst({
              where: {
                produtoId: kitProduto.produtoId,
                armazemId,
              },
            });

            if (!estoque) {
              return res.status(400).json({
                error: `Produto ${kitProduto.produto.nome} não encontrado no estoque do armazém selecionado`,
              });
            }

            if (estoque.quantidade < kitProduto.quantidade * quantidade) {
              return res.status(400).json({
                error: `Quantidade insuficiente do produto ${kitProduto.produto.nome} no estoque do armazém selecionado`,
              });
            }
          }

          // Atualizar o estoque para cada produto do kit
          for (const kitProduto of kitProdutos) {
            const estoque = await prisma.estoque.findFirst({
              where: {
                produtoId: kitProduto.produtoId,
                armazemId,
              },
            });

            if (estoque) {
              await prisma.estoque.update({
                where: { id: estoque.id },
                data: {
                  quantidade:
                    estoque.quantidade - kitProduto.quantidade * quantidade,
                },
              });
            }

            await prisma.saida.create({
              data: {
                produtoId: kitProduto.produtoId,
                quantidade: kitProduto.quantidade * quantidade,
                armazemId,
                data: new Date(),
              },
            });
          }
        } else {
          const estoque = await prisma.estoque.findFirst({
            where: {
              produtoId,
              armazemId,
            },
          });

          if (!estoque) {
            return res.status(400).json({
              error: `Produto não encontrado no estoque do armazém selecionado`,
            });
          }

          if (estoque.quantidade < quantidade) {
            return res.status(400).json({
              error: `Quantidade insuficiente do produto no estoque do armazém selecionado`,
            });
          }

          await prisma.estoque.update({
            where: { id: estoque.id },
            data: {
              quantidade: estoque.quantidade - quantidade,
            },
          });

          await prisma.saida.create({
            data: {
              produtoId,
              quantidade,
              armazemId,
              data: new Date(),
            },
          });
        }
      }

      res.status(201).json({ message: "Saída registrada com sucesso" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erro ao registrar saída" });
    }
  } else if (req.method === "GET") {
    try {
      const saidas = await prisma.saida.findMany({
        include: {
          produto: true,
          armazem: true,
        },
      });
      res.status(200).json(saidas);
    } catch (error) {
      console.error("Erro ao buscar saídas:", error);
      res.status(500).json({ error: "Erro ao buscar saídas" });
    }
  } else {
    res.status(405).json({ error: "Método não permitido" });
  }
}
