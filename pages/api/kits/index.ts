import { PrismaClient } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";

const prisma = new PrismaClient();

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
        const produtosEncontrados = await prisma.produto.findMany({
          where: {
            sku: {
              contains: sku as string,
            },
          },
          include: {
            estoques: true,
            componentes: {
              include: {
                produto: true,
              },
            },
          },
        });

        produtos = produtosEncontrados;

        // Se não encontrar produtos, buscar kits pelo SKU
        if (produtos.length === 0) {
          const kitsEncontrados = await prisma.produto.findMany({
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

          produtos = kitsEncontrados;
        }
      } else if (armazemId) {
        // Buscar produtos pelo armazemId
        produtos = await prisma.produto.findMany({
          where: {
            estoques: {
              some: {
                armazemId: Number(armazemId),
              },
            },
          },
          include: {
            estoques: true,
            componentes: {
              include: {
                produto: true,
              },
            },
          },
        });
      } else {
        // Buscar todos os produtos se nenhum parâmetro for fornecido
        produtos = await prisma.produto.findMany({
          include: {
            estoques: true,
            componentes: {
              include: {
                produto: true,
              },
            },
          },
        });
      }

      res.status(200).json(produtos);
    } catch (error) {
      console.error("Erro ao buscar produtos:", error);
      res.status(500).json({ error: "Erro ao buscar produtos" });
    }
  } else if (req.method === "POST") {
    const { nome, sku, componentes } = req.body;

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

        res.status(201).json(kitComComponentes);
      } else {
        // Criar um produto
        const novoProduto = await prisma.produto.create({
          data: {
            nome,
            sku,
            isKit: false,
          },
        });
        res.status(201).json(novoProduto);
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
