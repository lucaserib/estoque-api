import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";

interface FornecedorAssignment {
  fornecedorId: string;
  preco: number;
  multiplicador: number;
  codigoNF: string;
}

interface BulkAssignBody {
  produtoIds: string[];
  custoMedio?: number;
  fornecedor?: FornecedorAssignment;
}

interface SkippedProduto {
  produtoId: string;
  motivo: string;
}

interface BulkAssignResponse {
  success: boolean;
  updated: number;
  skipped: SkippedProduto[];
}

interface BulkAssignError {
  error: string;
  code?: string;
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<BulkAssignResponse | BulkAssignError>> {
  try {
    const user = await verifyUser(request);
    const body: BulkAssignBody = await request.json();
    const { produtoIds, custoMedio, fornecedor } = body;

    if (!Array.isArray(produtoIds) || produtoIds.length === 0) {
      return NextResponse.json(
        { error: "Selecione ao menos um produto" },
        { status: 400 }
      );
    }

    if (custoMedio === undefined && !fornecedor) {
      return NextResponse.json(
        { error: "Informe um custo médio ou um fornecedor para aplicar" },
        { status: 400 }
      );
    }

    if (
      fornecedor &&
      (!fornecedor.fornecedorId ||
        fornecedor.preco === undefined ||
        !fornecedor.multiplicador ||
        !fornecedor.codigoNF)
    ) {
      return NextResponse.json(
        {
          error:
            "Fornecedor, preço, multiplicador e código NF são obrigatórios para vincular fornecedor",
        },
        { status: 400 }
      );
    }

    const produtosDoUsuario = await prisma.produto.findMany({
      where: { id: { in: produtoIds }, userId: user.contaId },
      select: { id: true },
    });
    const produtoIdsValidos = new Set(produtosDoUsuario.map((p) => p.id));

    if (fornecedor) {
      const fornecedorValido = await prisma.fornecedor.findFirst({
        where: { id: fornecedor.fornecedorId, userId: user.contaId },
        select: { id: true },
      });

      if (!fornecedorValido) {
        return NextResponse.json(
          {
            error: "Fornecedor não encontrado ou não autorizado",
            code: "FORNECEDOR_NAO_ENCONTRADO",
          },
          { status: 404 }
        );
      }
    }

    const precoFornecedorEmCentavos = fornecedor
      ? Math.round(fornecedor.preco * 100)
      : null;

    let updated = 0;
    const skipped: SkippedProduto[] = [];

    for (const produtoId of produtoIds) {
      if (!produtoIdsValidos.has(produtoId)) {
        skipped.push({
          produtoId,
          motivo: "Produto não encontrado ou não pertence ao usuário",
        });
        continue;
      }

      try {
        if (custoMedio !== undefined) {
          await prisma.produto.update({
            where: { id: produtoId },
            data: { custoMedio },
          });
        }

        if (fornecedor && precoFornecedorEmCentavos !== null) {
          const vinculoExistente = await prisma.produtoFornecedor.findFirst({
            where: { produtoId, fornecedorId: fornecedor.fornecedorId },
          });

          const vinculo = vinculoExistente
            ? await prisma.produtoFornecedor.update({
                where: { id: vinculoExistente.id },
                data: {
                  preco: precoFornecedorEmCentavos,
                  precoUnitario: precoFornecedorEmCentavos,
                  multiplicador: fornecedor.multiplicador,
                  codigoNF: fornecedor.codigoNF,
                  principal: true,
                },
              })
            : await prisma.produtoFornecedor.create({
                data: {
                  produtoId,
                  fornecedorId: fornecedor.fornecedorId,
                  preco: precoFornecedorEmCentavos,
                  precoUnitario: precoFornecedorEmCentavos,
                  multiplicador: fornecedor.multiplicador,
                  codigoNF: fornecedor.codigoNF,
                  principal: true,
                },
              });

          await prisma.produtoFornecedor.updateMany({
            where: { produtoId, NOT: { id: vinculo.id } },
            data: { principal: false },
          });
        }

        updated++;
      } catch (error) {
        console.error(
          `Erro ao aplicar atribuição em lote no produto ${produtoId}:`,
          error
        );
        skipped.push({ produtoId, motivo: "Erro ao salvar as alterações" });
      }
    }

    return NextResponse.json({ success: true, updated, skipped });
  } catch (error) {
    console.error("Erro ao processar atribuição em lote:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
