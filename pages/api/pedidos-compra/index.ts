import { PrismaClient } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "POST") {
    // Criar um novo pedido de compra
    try {
      const {
        fornecedorId,
        produtos,
        comentarios,
      }: { fornecedorId: number; produtos: any[]; comentarios?: string } =
        req.body;

      if (!fornecedorId || !produtos || produtos.length === 0) {
        return res
          .status(400)
          .json({ error: "Fornecedor e produtos são obrigatórios" });
      }

      const pedido = await prisma.pedidoCompra.create({
        data: {
          fornecedorId,
          comentarios,
          status: "pendente", // Pedido criado com status pendente
          produtos: {
            create: produtos.map((produto) => ({
              produtoId: produto.produtoId,
              quantidade: produto.quantidade,
              custo: produto.custo,
            })),
          },
        },
      });
      res.status(201).json(pedido);
    } catch (error) {
      res.status(500).json({ error: "Erro ao criar pedido de compra" });
    }
  } else if (req.method === "GET") {
    // Obter todos os pedidos de compra
    try {
      const pedidos = await prisma.pedidoCompra.findMany({
        include: {
          produtos: true,
          fornecedor: true,
        },
      });
      res.status(200).json(pedidos);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar pedidos" });
    }
  } else if (req.method === "PUT") {
    // Confirmar um pedido de compra e atualizar o estoque
    try {
      const {
        pedidoId,
        armazemId,
        produtosRecebidos,
      }: { pedidoId: number; armazemId: number; produtosRecebidos: any[] } =
        req.body;

      if (!pedidoId || !armazemId || !produtosRecebidos) {
        return res.status(400).json({
          error: "Pedido, armazém e produtos recebidos são obrigatórios",
        });
      }

      // Verifica se o pedido existe
      const pedidoExistente = await prisma.pedidoCompra.findUnique({
        where: { id: pedidoId },
      });

      if (!pedidoExistente) {
        return res.status(404).json({ error: "Pedido não encontrado" });
      }

      // Atualiza a quantidade de produtos no pedido
      await Promise.all(
        produtosRecebidos.map(async (produtoRecebido) => {
          await prisma.pedidoProduto.updateMany({
            where: {
              pedidoId: pedidoId,
              produtoId: produtoRecebido.produtoId,
            },
            data: {
              quantidade: produtoRecebido.quantidade,
            },
          });
        })
      );

      // Atualiza o status do pedido para "confirmado"
      const pedido = await prisma.pedidoCompra.update({
        where: { id: pedidoId },
        data: { status: "confirmado" },
        include: { produtos: true }, // Incluir produtos para atualização do estoque
      });

      // Atualiza o estoque de acordo com os produtos recebidos (pode ser menor do que o solicitado)
      await Promise.all(
        produtosRecebidos.map(async (produtoRecebido) => {
          const pedidoProduto = pedido.produtos.find(
            (p) => p.produtoId === produtoRecebido.produtoId
          );
          if (!pedidoProduto) {
            throw new Error("Produto no pedido não encontrado");
          }

          const estoque = await prisma.estoque.findFirst({
            where: {
              produtoId: produtoRecebido.produtoId,
              armazemId: armazemId,
            },
          });
          if (estoque) {
            // Atualiza a quantidade no estoque existente
            await prisma.estoque.update({
              where: { id: estoque.id },
              data: {
                quantidade: estoque.quantidade + produtoRecebido.quantidade,
                valorUnitario: produtoRecebido.valorUnitario,
              },
            });
          } else {
            // Cria um novo registro de estoque se não existir
            await prisma.estoque.create({
              data: {
                armazemId: armazemId,
                quantidade: produtoRecebido.quantidade,
                valorUnitario: produtoRecebido.valorUnitario,
                produto: {
                  connect: { id: produtoRecebido.produtoId },
                },
              },
            });
          }
        })
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
    // Deletar um pedido de compra
    try {
      const { pedidoId }: { pedidoId: number } = req.body;

      if (!pedidoId) {
        return res.status(400).json({ error: "PedidoId é obrigatório" });
      }

      // Deletar os produtos associados ao pedido
      await prisma.pedidoProduto.deleteMany({
        where: { pedidoId: pedidoId },
      });

      // Deletar o pedido
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
