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
    const { fornecedorId } = req.query;

    if (!fornecedorId) {
      return res.status(400).json({ error: "FornecedorId é obrigatório" });
    }

    try {
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
    } catch (error) {
      console.error("Erro ao buscar produtos do fornecedor:", error);
      return res
        .status(500)
        .json({ error: "Erro ao buscar produtos do fornecedor" });
    }
  } else {
    return res.status(405).json({ message: "Método não permitido" });
  }
}
