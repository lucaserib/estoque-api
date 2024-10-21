import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "POST") {
    try {
      const {
        nome,
        cnpj,
        inscricaoEstadual,
        contato,
        endereco,
      }: {
        nome: string;
        cnpj?: string;
        inscricaoEstadual?: string;
        contato?: string;
        endereco?: string;
      } = req.body;

      if (!nome) {
        return res
          .status(400)
          .json({ error: "Nome do fornecedor é obrigatório" });
      }

      const fornecedor = await prisma.fornecedor.create({
        data: {
          nome,
          cnpj,
          inscricaoEstadual,
          contato,
          endereco,
        },
      });
      res.status(201).json(fornecedor);
    } catch (error) {
      res.status(500).json({ error: "Erro ao criar fornecedor" });
    }
  } else if (req.method === "GET") {
    try {
      const fornecedores = await prisma.fornecedor.findMany();
      res.status(200).json(fornecedores);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar fornecedores" });
    }
  } else if (req.method === "DELETE") {
    try {
      const { id } = req.query;
      if (!id) {
        return res
          .status(400)
          .json({ error: "ID do fornecedor é obrigatório" });
      }
      await prisma.fornecedor.delete({ where: { id: Number(id) } });
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ error: "Erro ao deletar fornecedor" });
    }
  } else {
    res.status(405).json({ error: "Método não permitido" });
  }
}
