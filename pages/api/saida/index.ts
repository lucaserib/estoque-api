import { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";

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
        .json({ error: "Produtos e Armazém são obrigatórios" });
    }

    try {
      for (const produto of produtos) {
        const { sku, quantidade, isKit } = produto;

        // Primeiro, tentar encontrar o produto pelo SKU
        const produtoEncontrado = await prisma.produto.findUnique({
          where: { sku },
          include: {
            componentes: {
              include: { produto: true },
            },
          },
        });

        if (!produtoEncontrado) {
          return res
            .status(404)
            .json({ error: `Produto com SKU ${sku} não encontrado` });
        }

        // Se o produto for um kit, verificar e retirar os produtos componentes do estoque
        if (isKit) {
          for (const componente of produtoEncontrado.componentes) {
            const { produto, quantidade: qtdComponente } = componente;

            // Verificar se o componente existe no estoque
            const estoque = await prisma.estoque.findFirst({
              where: {
                produtoId: produto.id,
                armazemId: Number(armazemId),
              },
            });

            if (!estoque || estoque.quantidade < qtdComponente * quantidade) {
              return res
                .status(400)
                .json({
                  error: `Estoque insuficiente para o componente ${produto.sku}`,
                });
            }

            // Atualizar o estoque de cada produto componente com base na quantidade do kit
            await prisma.estoque.updateMany({
              where: {
                produtoId: produto.id,
                armazemId: Number(armazemId),
              },
              data: {
                quantidade: {
                  decrement: qtdComponente * quantidade, // Multiplica pela quantidade de kits
                },
              },
            });
          }
        } else {
          // Caso seja um produto normal, atualizar diretamente o estoque
          await prisma.estoque.updateMany({
            where: {
              produtoId: produtoEncontrado.id,
              armazemId: Number(armazemId),
            },
            data: {
              quantidade: {
                decrement: quantidade,
              },
            },
          });
        }
      }

      res.status(200).json({
        message: "Produtos adicionados ao pedido e estoques atualizados",
      });
    } catch (error) {
      console.error("Erro ao processar pedido:", error);
      res.status(500).json({ error: "Erro ao processar pedido" });
    }
  } else {
    res.status(405).json({ message: "Método não permitido" });
  }
}
