import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyUser } from "@/helpers/verifyUser";
import { normalizeSku } from "@/lib/sku";
import { FULL_ARMAZEM_NOME } from "@/lib/estoque";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";

const linhaSchema = z.object({
  sku: z.string().min(1),
  quantidade: z.number().int().min(0),
  custoMedio: z.number().int().min(0).optional(),
  armazem: z.string().min(1),
});

const importarSchema = z.object({
  linhas: z.array(linhaSchema).min(1).max(2000),
});

interface LinhaRejeitada {
  linha: number;
  sku: string;
  motivo: string;
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);

    const rateLimit = await checkRateLimit("estoque-importar", user.id, 5, 300);
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit);
    }

    const parsed = importarSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { linhas } = parsed.data;

    const produtos = await prisma.produto.findMany({
      where: { userId: user.id },
      select: { id: true, sku: true },
    });
    const produtoPorSku = new Map(
      produtos.map((p) => [normalizeSku(p.sku), p.id])
    );

    const armazens = await prisma.armazem.findMany({
      where: { userId: user.id },
      select: { id: true, nome: true },
    });
    const armazemPorNome = new Map(
      armazens.map((a) => [a.nome.trim().toLowerCase(), a.id])
    );

    let aceitas = 0;
    const rejeitadas: LinhaRejeitada[] = [];

    for (let i = 0; i < linhas.length; i++) {
      const linha = linhas[i];
      const skuNormalizado = normalizeSku(linha.sku);
      const produtoId = produtoPorSku.get(skuNormalizado);

      if (!produtoId) {
        rejeitadas.push({
          linha: i + 1,
          sku: linha.sku,
          motivo: "SKU não encontrado nos produtos cadastrados",
        });
        continue;
      }

      const nomeArmazem = linha.armazem.trim();

      if (nomeArmazem === FULL_ARMAZEM_NOME) {
        rejeitadas.push({
          linha: i + 1,
          sku: linha.sku,
          motivo: "O armazém Full é gerenciado automaticamente pelo Mercado Livre",
        });
        continue;
      }

      let armazemId = armazemPorNome.get(nomeArmazem.toLowerCase());

      if (!armazemId) {
        try {
          const novoArmazem = await prisma.armazem.create({
            data: { nome: nomeArmazem, userId: user.id },
          });
          armazemId = novoArmazem.id;
          armazemPorNome.set(nomeArmazem.toLowerCase(), armazemId);
        } catch (armazemError) {
          rejeitadas.push({
            linha: i + 1,
            sku: linha.sku,
            motivo: "Não foi possível criar o armazém informado",
          });
          continue;
        }
      }

      try {
        const estoqueAtual = await prisma.estoque.findUnique({
          where: { produtoId_armazemId: { produtoId, armazemId } },
        });

        await prisma.$transaction([
          prisma.estoque.upsert({
            where: { produtoId_armazemId: { produtoId, armazemId } },
            create: { produtoId, armazemId, quantidade: linha.quantidade },
            update: { quantidade: linha.quantidade },
          }),
          prisma.estoqueMovimentacao.create({
            data: {
              userId: user.id,
              produtoId,
              armazemId,
              quantidadeAnterior: estoqueAtual?.quantidade ?? 0,
              quantidadeNova: linha.quantidade,
              origem: "IMPORTACAO_PLANILHA",
            },
          }),
          ...(linha.custoMedio !== undefined
            ? [
                prisma.produto.update({
                  where: { id: produtoId },
                  data: { custoMedio: linha.custoMedio },
                }),
              ]
            : []),
        ]);

        aceitas++;
      } catch (rowError) {
        console.error(`Erro ao importar linha ${i + 1}:`, rowError);
        rejeitadas.push({
          linha: i + 1,
          sku: linha.sku,
          motivo: "Erro ao gravar estoque para esta linha",
        });
      }
    }

    return NextResponse.json({ success: true, aceitas, rejeitadas });
  } catch (error) {
    console.error("Erro ao importar planilha de estoque:", error);
    return NextResponse.json(
      { error: "Erro ao importar planilha de estoque" },
      { status: 500 }
    );
  }
}
