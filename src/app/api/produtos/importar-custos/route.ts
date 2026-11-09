import { atualizarCustoDasVendasAposMudanca } from "@/modules/financeiro/ingestao/sincronizador";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { normalizeSku } from "@/lib/sku";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { permissaoErrorResponse } from "@/lib/permissoes";

const linhaSchema = z.object({
  sku: z.string().min(1),
  custoMedio: z.number().int().min(0),
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
    const user = await verifyUserAtivo(request);

    const rateLimit = await checkRateLimit(
      "produtos-importar-custos",
      user.id,
      5,
      300
    );
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
      where: { userId: user.contaId },
      select: { id: true, sku: true },
    });
    const produtoPorSku = new Map(
      produtos.map((p) => [normalizeSku(p.sku), p.id])
    );

    let aceitas = 0;

    const produtosAtualizados: string[] = [];
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

      try {
        await prisma.produto.update({
          where: { id: produtoId },
          data: { custoMedio: linha.custoMedio },
        });
        produtosAtualizados.push(produtoId);
        aceitas++;
      } catch (rowError) {
        console.error(`Erro ao importar custo da linha ${i + 1}:`, rowError);
        rejeitadas.push({
          linha: i + 1,
          sku: linha.sku,
          motivo: "Erro ao gravar custo médio para esta linha",
        });
      }
    }

    if (produtosAtualizados.length > 0) await atualizarCustoDasVendasAposMudanca(user.contaId, produtosAtualizados);
    return NextResponse.json({ success: true, aceitas, rejeitadas });
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    console.error("Erro ao importar planilha de custos:", error);
    return NextResponse.json(
      { error: "Erro ao importar planilha de custos" },
      { status: 500 }
    );
  }
}
