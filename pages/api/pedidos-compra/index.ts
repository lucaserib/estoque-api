import { PrismaClient } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";

const prisma = new PrismaClient();

// Função para serializar BigInt como string
const serializeBigInt = (obj: unknown): unknown => {
  return JSON.parse(
    JSON.stringify(obj, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
};

interface ProdutoRecebido {
  produtoId: number;
  quantidade: number;
  custo: number;
}

interface RequestBodyPost {
  fornecedorId: number;
  produtos: ProdutoRecebido[];
  comentarios?: string;
  dataPrevista?: string;
}

interface RequestBodyPut {
  pedidoId: number;
  armazemId: number;
  produtosRecebidos: ProdutoRecebido[];
  comentarios?: string;
}

interface RequestBodyDelete {
  pedidoId: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "POST") {
    try {
      const {
        fornecedorId,
        produtos,
        comentarios,
        dataPrevista,
      }: RequestBodyPost = req.body;

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
          dataPrevista: dataPrevista ? new Date(dataPrevista) : null,
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
      console.error("Erro ao criar pedido de compra:", error);
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
      res.status(200).json(serializeBigInt(pedidos));
    } catch (error) {
      console.error("Erro ao buscar pedidos:", error);
      res.status(500).json({ error: "Erro ao buscar pedidos" });
    }
  } else if (req.method === "PUT") {
    try {
      const {
        pedidoId,
        armazemId,
        produtosRecebidos,
        comentarios,
      }: RequestBodyPut = req.body;

      if (!pedidoId || !armazemId || !produtosRecebidos) {
        return res.status(400).json({
          error: "Pedido, armazém e produtos recebidos são obrigatórios",
        });
      }

      const armazemExistente = await prisma.armazem.findUnique({
        where: { id: armazemId },
      });

      if (!armazemExistente) {
        return res.status(404).json({ error: "Armazém não encontrado" });
      }

      const pedidoExistente = await prisma.pedidoCompra.findUnique({
        where: { id: pedidoId },
        include: { produtos: true },
      });

      if (!pedidoExistente) {
        return res.status(404).json({ error: "Pedido não encontrado" });
      }

      const produtosNaoRecebidos: ProdutoRecebido[] = [];

      await Promise.all(
        produtosRecebidos.map(async (produtoRecebido) => {
          const produtoPedido = pedidoExistente.produtos.find(
            (produto) => produto.produtoId === produtoRecebido.produtoId
          );

          if (produtoPedido) {
            const quantidadeNaoRecebida =
              produtoPedido.quantidade - produtoRecebido.quantidade;

            if (quantidadeNaoRecebida > 0) {
              produtosNaoRecebidos.push({
                produtoId: produtoRecebido.produtoId,
                quantidade: quantidadeNaoRecebida,
                custo: produtoRecebido.custo,
              });
            }

            // Atualizando a quantidade do produto no pedido conforme o recebido
            await prisma.pedidoProduto.update({
              where: {
                id: produtoPedido.id,
              },
              data: {
                quantidade: produtoRecebido.quantidade,
                custo: produtoRecebido.custo,
              },
            });

            // Atualizando o estoque
            const estoqueExistente = await prisma.estoque.findFirst({
              where: {
                produtoId: produtoRecebido.produtoId,
                armazemId: armazemId,
              },
            });

            if (estoqueExistente) {
              await prisma.estoque.update({
                where: {
                  produtoId_armazemId: {
                    produtoId: produtoRecebido.produtoId,
                    armazemId: armazemId,
                  },
                },
                data: {
                  quantidade: {
                    increment: produtoRecebido.quantidade,
                  },
                  valorUnitario: produtoRecebido.custo,
                },
              });
            } else {
              await prisma.estoque.create({
                data: {
                  produtoId: produtoRecebido.produtoId,
                  armazemId: armazemId,
                  quantidade: produtoRecebido.quantidade,
                  valorUnitario: produtoRecebido.custo,
                },
              });
            }
          }
        })
      );

      if (produtosNaoRecebidos.length > 0) {
        await prisma.pedidoCompra.create({
          data: {
            fornecedorId: pedidoExistente.fornecedorId,
            comentarios:
              "Produtos não recebidos do pedido #" + pedidoExistente.id,
            status: "pendente",
            produtos: {
              create: produtosNaoRecebidos.map((produto) => ({
                produtoId: produto.produtoId,
                quantidade: produto.quantidade,
                custo: produto.custo,
              })),
            },
          },
        });
      }

      await prisma.pedidoCompra.update({
        where: { id: pedidoId },
        data: {
          status: "confirmado",
          armazemId: armazemId,
          dataConclusao: new Date(),
          ...(comentarios && { comentarios }), // Atualização dos comentários, se fornecido
        },
      });

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
      const { pedidoId }: RequestBodyDelete = req.body;

      if (!pedidoId) {
        return res.status(400).json({ error: "ID do pedido é obrigatório" });
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
