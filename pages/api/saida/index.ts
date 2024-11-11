import { PrismaClient } from "@prisma/client";
import { NextApiRequest, NextApiResponse } from "next";

const prisma = new PrismaClient();

// Função para serializar BigInt como string
const serializeBigInt = (obj: unknown): unknown => {
  return JSON.parse(
    JSON.stringify(obj, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
};

interface Produto {
  sku: string;
  quantidade: number;
  isKit: boolean;
}

interface RequestBody {
  produtos: Produto[];
  armazemId: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "POST") {
    const { produtos, armazemId }: RequestBody = req.body;

    if (!produtos || !armazemId) {
      return res
        .status(400)
        .json({ error: "Produtos e Armazém são obrigatórios" });
    }

    try {
      // Criar uma nova saída
      const saida = await prisma.saida.create({
        data: {
          data: new Date(),
          armazemId: Number(armazemId),
        },
      });

      // Processamento da saída dos produtos
      for (const produto of produtos) {
        const { sku, quantidade, isKit } = produto;

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
            return res.status(404).json({ error: "Kit não encontrado" });
          }

          for (const componente of kitEncontrado.componentes) {
            const estoqueComponente = await prisma.estoque.findFirst({
              where: {
                produtoId: componente.produtoId,
                armazemId: Number(armazemId),
              },
            });

            if (
              !estoqueComponente ||
              estoqueComponente.quantidade < componente.quantidade * quantidade
            ) {
              return res
                .status(400)
                .json({ error: "Estoque insuficiente para o componente" });
            }

            await prisma.estoque.update({
              where: {
                produtoId_armazemId: {
                  produtoId: componente.produtoId,
                  armazemId: Number(armazemId),
                },
              },
              data: {
                quantidade: {
                  decrement: componente.quantidade * quantidade,
                },
              },
            });

            await prisma.detalhesSaida.create({
              data: {
                saidaId: saida.id,
                produtoId: componente.produtoId,
                quantidade: componente.quantidade * quantidade,
                isKit: true,
              },
            });
          }
        } else {
          const produtoEncontrado = await prisma.produto.findUnique({
            where: { sku },
          });

          if (!produtoEncontrado) {
            return res.status(404).json({ error: "Produto não encontrado" });
          }

          const estoqueProduto = await prisma.estoque.findFirst({
            where: {
              produtoId: produtoEncontrado.id,
              armazemId: Number(armazemId),
            },
          });

          if (!estoqueProduto || estoqueProduto.quantidade < quantidade) {
            return res.status(400).json({ error: "Estoque insuficiente" });
          }

          await prisma.estoque.update({
            where: {
              produtoId_armazemId: {
                produtoId: produtoEncontrado.id,
                armazemId: Number(armazemId),
              },
            },
            data: {
              quantidade: {
                decrement: quantidade,
              },
            },
          });

          await prisma.detalhesSaida.create({
            data: {
              saidaId: saida.id,
              produtoId: produtoEncontrado.id,
              quantidade,
              isKit: false,
            },
          });
        }
      }

      return res.status(200).json({ message: "Saída registrada com sucesso!" });
    } catch (error) {
      console.error("Erro ao registrar saída:", error);
      return res.status(500).json({ error: "Erro ao registrar saída" });
    }
  } else if (req.method === "GET") {
    try {
      const saidas = await prisma.saida.findMany({
        include: {
          armazem: true,
          detalhes: {
            include: {
              produto: true,
            },
          },
        },
      });
      return res.status(200).json(serializeBigInt(saidas));
    } catch (error) {
      console.error("Erro ao buscar saídas:", error);
      return res.status(500).json({ error: "Erro ao buscar saídas" });
    }
  } else {
    return res.status(405).json({ error: "Método não permitido" });
  }
}
