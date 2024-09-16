import { PrismaClient } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "PUT") {
    try {
      const { pedidoId, armazemId }: { pedidoId: number; armazemId: number } =
        req.body;

      if (!pedidoId || !armazemId) {
        return res
          .status(400)
          .json({ error: "Pedido e armazém são obrigatórios" });
      }

      // Atualiza o status do pedido para "confirmado"
      const pedido = await prisma.pedidoCompra.update({
        where: { id: pedidoId },
        data: { status: "confirmado" },
        include: { produtos: true },
      });

      // Atualiza o estoque de acordo com os produtos do pedido
      await Promise.all(
        pedido.produtos.map(async (pedidoProduto) => {
          const estoque = await prisma.estoque.findFirst({
            where: {
              produtoId: pedidoProduto.produtoId,
              armazemId: armazemId, // Corrigir aqui para usar 'armazemId'
            },
          });
          if (estoque) {
            // Atualiza a quantidade no estoque existente
            await prisma.estoque.update({
              where: { id: estoque.id },
              data: {
                quantidade: estoque.quantidade + pedidoProduto.quantidade,
              },
            });
          } else {
            // Cria um novo registro de estoque se não existir
            await prisma.estoque.create({
              data: {
                armazemId: armazemId, // Corrigir aqui também
                produtoId: pedidoProduto.produtoId,
                quantidade: pedidoProduto.quantidade,
                valorUnitario: pedidoProduto.custo, // Adiciona valor unitário
              },
            });
          }
        })
      );

      res.status(200).json({
        message: "Pedido confirmado e estoque atualizado com sucesso",
      });
    } catch (error) {
      res
        .status(500)
        .json({ error: "Erro ao confirmar pedido e atualizar estoque" });
    }
  } else {
    res.status(405).json({ message: "Método não permitido" });
  }
}
