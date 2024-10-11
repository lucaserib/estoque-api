import { PrismaClient } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "POST") {
    const { produtos, armazemId } = req.body;

    if (!produtos || !armazemId) {
      return res
        .status(400)
        .json({ error: "Produtos e armazém são obrigatórios" });
    }

    try {
      // Processar cada produto/kit
      for (const produto of produtos) {
        if (produto.isKit) {
          const kitProdutos = await prisma.componente.findMany({
            where: { kitId: produto.produtoId },
            include: {
              produto: true, // Incluindo os produtos componentes do kit
            },
          });

          if (kitProdutos.length === 0) {
            return res
              .status(404)
              .json({ error: `Kit ${produto.sku} não encontrado` });
          }

          // Checar e atualizar o estoque de cada produto no kit
          for (const kitProduto of kitProdutos) {
            const estoque = await prisma.estoque.findFirst({
              where: {
                produtoId: kitProduto.produtoId,
                armazemId: armazemId,
              },
            });

            // Checar se há quantidade suficiente no estoque
            if (
              !estoque ||
              estoque.quantidade < kitProduto.quantidade * produto.quantidade
            ) {
              return res.status(400).json({
                error: `Estoque insuficiente para o produto ${kitProduto.produto.sku} no armazém ${armazemId}`,
              });
            }

            // Atualizar o estoque do produto do kit
            await prisma.estoque.update({
              where: {
                produtoId_armazemId: {
                  produtoId: kitProduto.produtoId,
                  armazemId: armazemId,
                },
              },
              data: {
                quantidade: {
                  decrement: kitProduto.quantidade * produto.quantidade,
                },
              },
            });

            // Registrar a saída do produto do kit
            await prisma.saida.create({
              data: {
                produtoId: kitProduto.produtoId,
                quantidade: kitProduto.quantidade * produto.quantidade,
                armazemId: armazemId,
                data: new Date(),
              },
            });
          }

          // Registrar a saída do kit
          await prisma.saida.create({
            data: {
              produtoId: produto.produtoId, // SKU do kit
              quantidade: produto.quantidade,
              armazemId: armazemId,
              data: new Date(),
            },
          });
        } else {
          // Lógica para produtos individuais
          const estoque = await prisma.estoque.findFirst({
            where: {
              produtoId: produto.produtoId,
              armazemId: armazemId,
            },
          });

          if (!estoque || estoque.quantidade < produto.quantidade) {
            return res.status(400).json({
              error: `Estoque insuficiente para o produto ${produto.sku} no armazém ${armazemId}`,
            });
          }

          // Atualizar o estoque de produto individual
          await prisma.estoque.update({
            where: {
              produtoId_armazemId: {
                produtoId: produto.produtoId,
                armazemId: armazemId,
              },
            },
            data: {
              quantidade: {
                decrement: produto.quantidade,
              },
            },
          });

          // Registrar a saída do produto individual
          await prisma.saida.create({
            data: {
              produtoId: produto.produtoId,
              quantidade: produto.quantidade,
              armazemId: armazemId,
              data: new Date(),
            },
          });
        }
      }

      res.status(200).json({ message: "Saída registrada com sucesso" });
    } catch (error) {
      console.error("Erro ao registrar saída:", error);
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
