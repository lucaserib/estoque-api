import { PrismaClient } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method } = req;

  switch (method) {
    case "GET":
      try {
        // Obtém todos os pedidos de compra
        const pedidos = await prisma.pedidoCompra.findMany({
          include: {
            produto: true,
            fornecedor: true,
          },
        });
        res.status(200).json(pedidos);
      } catch (error) {
        console.error("Erro ao obter pedidos:", error);
        res.status(500).json({ error: "Erro ao obter pedidos" });
      }
      break;

    case "POST":
      try {
        const { produtoId, fornecedorId, quantidade } = req.body;

        // Validação dos campos obrigatórios
        if (!produtoId || fornecedorId || !quantidade) {
          return res
            .status(400)
            .json({ error: "ProdutoId e quantidade são obrigatórios." });
        }

        // Cria um novo pedido de compra
        const novoPedido = await prisma.pedidoCompra.create({
          data: {
            produtoId: Number(produtoId),
            fornecedorId: Number(fornecedorId),
            quantidade: Number(quantidade),
          },
          include: {
            produto: true,
            fornecedor: true,
          },
        });

        res.status(201).json(novoPedido);
      } catch (error) {
        console.error("Erro ao criar pedido:", error);
        res.status(500).json({ error: "Erro ao criar pedido" });
      }
      break;

    case "PUT":
      try {
        const { id, dataRecebimento, recebido } = req.body;

        // Validação de campos obrigatórios
        if (!id || (dataRecebimento === undefined && recebido === undefined)) {
          return res.status(400).json({
            error:
              "ID e pelo menos um dos campos 'dataRecebimento' ou 'recebido' são obrigatórios.",
          });
        }

        // Atualiza um pedido de compra existente
        const pedidoAtualizado = await prisma.pedidoCompra.update({
          where: { id: Number(id) },
          data: {
            dataRecebimento: dataRecebimento
              ? new Date(dataRecebimento)
              : undefined,
            recebido: recebido !== undefined ? recebido : undefined,
          },
          include: {
            produto: true,
          },
        });

        res.status(200).json(pedidoAtualizado);
      } catch (error) {
        console.error("Erro ao atualizar o pedido de compra:", error);
        res.status(500).json({ error: "Erro ao atualizar o pedido de compra" });
      }
      break;

    default:
      res.status(405).json({ error: "Método não permitido" });
      break;
  }
}
