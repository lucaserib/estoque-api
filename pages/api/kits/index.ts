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
  if (req.method === "GET") {
    const { sku, armazemId } = req.query;

    try {
      let produtos: any[] = [];

      if (sku) {
        // Buscar produtos pelo SKU
        produtos = await prisma.produto.findMany({
          where: {
            isKit: true,
            sku: {
              contains: sku as string,
            },
          },
          include: {
            componentes: {
              include: {
                produto: true,
              },
            },
          },
        });
      } else if (armazemId) {
        // Buscar produtos pelo armazemId
        produtos = await prisma.produto.findMany({
          where: {
            isKit: true,
            estoques: {
              some: {
                armazemId: Number(armazemId),
              },
            },
          },
          include: {
            componentes: {
              include: {
                produto: true,
              },
            },
          },
        });
      } else {
        // Buscar todos os produtos que são kits se nenhum parâmetro for fornecido
        produtos = await prisma.produto.findMany({
          where: {
            isKit: true,
          },
          include: {
            componentes: {
              include: {
                produto: true,
              },
            },
          },
        });
      }

      res.status(200).json(serializeBigInt(produtos));
    } catch (error) {
      console.error("Erro ao buscar produtos:", error);
      res.status(500).json({ error: "Erro ao buscar produtos" });
    }
  } else if (req.method === "POST") {
    const { nome, sku, ean, componentes } = req.body;

    console.log("Recebido:", { nome, sku, ean, componentes });

    if (!nome || !sku) {
      return res.status(400).json({ error: "Nome e SKU são obrigatórios" });
    }

    try {
      if (componentes && componentes.length > 0) {
        // Criar um kit
        const novoKit = await prisma.produto.create({
          data: {
            nome,
            sku,
            ean: ean ? BigInt(ean) : null, // Certifique-se de que o EAN seja tratado como BigInt ou null
            isKit: true,
            componentes: {
              create: componentes.map((componente: any) => ({
                quantidade: componente.quantidade,
                produto: {
                  connect: { id: componente.produtoId },
                },
              })),
            },
          },
        });

        // Atualizar o estoque dos produtos componentes
        for (const componente of componentes) {
          await prisma.estoque.updateMany({
            where: { produtoId: componente.produtoId },
            data: { quantidade: { decrement: componente.quantidade } },
          });
        }

        // Incluir os componentes na resposta
        const kitComComponentes = await prisma.produto.findUnique({
          where: { id: novoKit.id },
          include: {
            componentes: {
              include: {
                produto: true,
              },
            },
          },
        });

        res.status(201).json(serializeBigInt(kitComComponentes));
      } else {
        return res
          .status(400)
          .json({ error: "Componentes são obrigatórios para kits" });
      }
    } catch (error) {
      console.error("Erro ao criar produto ou kit:", error);
      res.status(500).json({ error: "Erro ao criar produto ou kit" });
    }
  } else if (req.method === "DELETE") {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: "ID é obrigatório" });
    }

    try {
      await prisma.produto.delete({
        where: { id: Number(id) },
      });
      res.status(204).end();
    } catch (error) {
      console.error("Erro ao deletar produto:", error);
      res.status(500).json({ error: "Erro ao deletar produto" });
    }
  } else {
    res.status(405).json({ message: "Método não permitido" });
  }
}
