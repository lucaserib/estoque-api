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

        // Se for kit, buscar os componentes ao invés de buscar o kit no estoque
        if (isKit) {
          const kitEncontrado = await prisma.produto.findUnique({
            where: { sku },
            include: {
              componentes: {
                include: { produto: true },
              },
            },
          });

          if (!kitEncontrado) {
            return res
              .status(404)
              .json({ error: `Kit com SKU ${sku} não encontrado` });
          }

          // Processar os componentes do kit e atualizar o estoque de cada um
          for (const componente of kitEncontrado.componentes) {
            const { produto, quantidade: qtdComponente } = componente;

            // Verificar se o componente existe no estoque
            const estoque = await prisma.estoque.findFirst({
              where: {
                produtoId: produto.id,
                armazemId: Number(armazemId),
              },
            });

            if (!estoque || estoque.quantidade < qtdComponente * quantidade) {
              return res.status(400).json({
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
          // Caso seja um produto normal, verificar se existe no estoque e atualizar
          const produtoEncontrado = await prisma.produto.findUnique({
            where: { sku },
          });

          if (!produtoEncontrado) {
            return res
              .status(404)
              .json({ error: `Produto com SKU ${sku} não encontrado` });
          }

          // Verificar se o produto existe no estoque
          const estoque = await prisma.estoque.findFirst({
            where: {
              produtoId: produtoEncontrado.id,
              armazemId: Number(armazemId),
            },
          });

          if (!estoque || estoque.quantidade < quantidade) {
            return res
              .status(400)
              .json({ error: `Estoque insuficiente para o produto ${sku}` });
          }

          // Atualizar o estoque do produto
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

      // Retorno de sucesso
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
