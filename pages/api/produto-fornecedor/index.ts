import { PrismaClient } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";

const prisma = new PrismaClient();

// Função para serializar BigInt como string
const serializeBigInt = (obj: any) => {
  return JSON.parse(
    JSON.stringify(obj, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "POST") {
    const { produtoId, fornecedorId, preco, multiplicador, codigoNF } =
      req.body;

    if (!produtoId || !fornecedorId || !preco || !multiplicador || !codigoNF) {
      return res.status(400).json({
        error:
          "Produto, Fornecedor, Preço, Multiplicador e Código NF são obrigatórios",
      });
    }

    try {
      // Verificar se o produto já está vinculado ao fornecedor
      const vinculoExistente = await prisma.produtoFornecedor.findFirst({
        where: { produtoId, fornecedorId },
      });

      if (vinculoExistente) {
        return res
          .status(400)
          .json({ error: "Produto já vinculado a este fornecedor" });
      }

      // Criar o novo vínculo
      const vinculo = await prisma.produtoFornecedor.create({
        data: {
          produtoId,
          fornecedorId,
          preco,
          multiplicador,
          codigoNF,
        },
      });
      return res.status(201).json(vinculo);
    } catch (error) {
      return res.status(500).json({ error: "Erro ao vincular fornecedor" });
    }
  } else if (req.method === "GET") {
    const { fornecedorId, produtoId } = req.query;

    if (!fornecedorId && !produtoId) {
      return res
        .status(400)
        .json({ error: "FornecedorId ou ProdutoId é obrigatório" });
    }

    try {
      if (fornecedorId) {
        const produtos = await prisma.produtoFornecedor.findMany({
          where: {
            fornecedorId: Number(fornecedorId),
          },
          include: {
            produto: true,
          },
        });
        console.log("Produtos encontrados:", produtos);
        return res.status(200).json(serializeBigInt(produtos));
      } else if (produtoId) {
        const fornecedores = await prisma.produtoFornecedor.findMany({
          where: {
            produtoId: Number(produtoId),
          },
          include: {
            fornecedor: true,
          },
        });
        console.log("Fornecedores encontrados:", fornecedores);
        return res.status(200).json(serializeBigInt(fornecedores));
      }
    } catch (error) {
      console.error("Erro ao buscar produtos ou fornecedores:", error);
      return res
        .status(500)
        .json({ error: "Erro ao buscar produtos ou fornecedores" });
    }
  } else if (req.method === "DELETE") {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: "ID é obrigatório" });
    }

    try {
      await prisma.produtoFornecedor.delete({
        where: { id: Number(id) },
      });
      return res.status(204).end();
    } catch (error) {
      console.error("Erro ao deletar fornecedor:", error);
      return res.status(500).json({ error: "Erro ao deletar fornecedor" });
    }
  } else if (req.method === "PUT") {
    const { id, preco, multiplicador, codigoNF } = req.body;

    if (!id || !preco || !multiplicador || !codigoNF) {
      return res.status(400).json({
        error: "ID, Preço, Multiplicador e Código NF são obrigatórios",
      });
    }

    try {
      const vinculo = await prisma.produtoFornecedor.update({
        where: { id: Number(id) },
        data: {
          preco,
          multiplicador,
          codigoNF,
        },
      });
      return res.status(200).json(vinculo);
    } catch (error) {
      console.error("Erro ao atualizar fornecedor:", error);
      return res.status(500).json({ error: "Erro ao atualizar fornecedor" });
    }
  } else {
    return res.status(405).json({ message: "Método não permitido" });
  }
}
