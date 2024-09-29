import { PrismaClient } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "POST") {
    try {
      const { fornecedorId, produtos, comentarios } = req.body;

      if (!fornecedorId || !produtos || produtos.length === 0) {
        return res
          .status(400)
          .json({ error: "Fornecedor e produtos são obrigatórios" });
      }

      const pedido = await prisma.pedidoCompra.create({
        data: {
          fornecedorId,
          comentarios,
          status: "pendente",
          produtos: {
            create: produtos.map(
              (produto: {
                produtoId: number;
                quantidade: number;
                custo: number;
              }) => ({
                produtoId: produto.produtoId,
                quantidade: produto.quantidade,
                custo: produto.custo,
              })
            ),
          },
        },
      });
      res.status(201).json(pedido);
    } catch (error) {
      res.status(500).json({ error: "Erro ao criar pedido de compra" });
    }
  } else if (req.method === "GET") {
    try {
      const pedidos = await prisma.pedidoCompra.findMany({
        include: {
          produtos: {
            include: {
              produto: true, // Inclui os dados do produto
            },
          },
          fornecedor: true,
        },
      });
      res.status(200).json(pedidos);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar pedidos" });
    }
  } else if (req.method === "PUT") {
    try {
      const { pedidoId, armazemId, produtosRecebidos } = req.body;

      console.log("Recebendo dados para atualização:", {
        pedidoId,
        armazemId,
        produtosRecebidos,
      });

      if (!pedidoId || !armazemId || !produtosRecebidos) {
        return res.status(400).json({
          error: "Pedido, armazém e produtos recebidos são obrigatórios",
        });
      }

      const pedidoExistente = await prisma.pedidoCompra.findUnique({
        where: { id: pedidoId },
      });

      if (!pedidoExistente) {
        return res.status(404).json({ error: "Pedido não encontrado" });
      }

      await Promise.all(
        produtosRecebidos.map(
          async (produtoRecebido: {
            produtoId: number;
            quantidade: number;
          }) => {
            await prisma.pedidoProduto.updateMany({
              where: {
                pedidoId: pedidoId,
                produtoId: produtoRecebido.produtoId,
              },
              data: {
                quantidade: produtoRecebido.quantidade,
              },
            });
          }
        )
      );

      const pedido = await prisma.pedidoCompra.update({
        where: { id: pedidoId },
        data: { status: "confirmado", armazemId: armazemId },
        include: { produtos: true },
      });

      await Promise.all(
        produtosRecebidos.map(
          async (produtoRecebido: {
            produtoId: number;
            quantidade: number;
          }) => {
            const pedidoProduto = pedido.produtos.find(
              (p) => p.produtoId === produtoRecebido.produtoId
            );
            if (!pedidoProduto) {
              throw new Error("Produto não encontrado no pedido");
            }

            const estoque = await prisma.estoque.findFirst({
              where: {
                produtoId: produtoRecebido.produtoId,
                armazemId: armazemId,
              },
            });
            if (estoque) {
              await prisma.estoque.update({
                where: { id: estoque.id },
                data: {
                  quantidade: estoque.quantidade + produtoRecebido.quantidade,
                },
              });
            } else {
              await prisma.estoque.create({
                data: {
                  produtoId: produtoRecebido.produtoId,
                  armazemId: armazemId,
                  quantidade: produtoRecebido.quantidade,
                  valorUnitario: pedidoProduto.custo,
                },
              });
            }
          }
        )
      );

      res.status(200).json({
        message: "Pedido confirmado e estoque atualizado com sucesso",
      });
    } catch (error) {
      console.error("Erro ao confirmar pedido:", error);
      res
        .status(500)
        .json({ error: "Erro ao confirmar pedido e atualizar estoque" });
    }
  } else if (req.method === "DELETE") {
    try {
      const { pedidoId } = req.body;

      if (!pedidoId) {
        return res.status(400).json({ error: "PedidoId é obrigatório" });
      }

      await prisma.pedidoProduto.deleteMany({
        where: { pedidoId: pedidoId },
      });

      await prisma.pedidoCompra.delete({
        where: { id: pedidoId },
      });

      res.status(200).json({ message: "Pedido deletado com sucesso" });
    } catch (error) {
      console.error("Erro ao deletar pedido:", error);
      res.status(500).json({ error: "Erro ao deletar pedido" });
    }
  } else {
    res.status(405).json({ message: "Método não permitido" });
  }
}
