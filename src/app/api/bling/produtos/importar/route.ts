import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { BlingService, BlingReconnectError } from "@/services/blingService";
import { blingErrorResponse } from "@/lib/blingApi";
import { normalizeSku } from "@/lib/sku";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import {
  aplicarDetalheProdutoBling,
  resolverFornecedorPrincipalBling,
  sincronizarComponentesKitBling,
  vincularFornecedorProdutoBling,
} from "@/services/blingProductSync";

const importarSchema = z.object({
  accountId: z.string().min(1, "ID da conta Bling não fornecido"),
  completa: z.boolean().optional(),
});

interface LocalProdutoResumo {
  id: string;
  blingId: string | null;
  sku: string;
}

function formatarDataBling(data: Date): string {
  return data.toISOString().slice(0, 19).replace("T", " ");
}

async function processarImportacao(
  accountId: string,
  userId: string,
  dataAlteracaoInicial: string | undefined,
  syncHistoryId: string
): Promise<void> {
  const startTime = Date.now();
  let criados = 0;
  let atualizados = 0;
  let ignorados = 0;
  const erros: string[] = [];

  try {
    const blingProducts = await BlingService.getAllProducts(
      accountId,
      dataAlteracaoInicial
    );

    const produtosExistentes = await prisma.produto.findMany({
      where: { userId },
      select: { id: true, blingId: true, sku: true },
    });
    const porBlingId = new Map(
      produtosExistentes
        .filter((p): p is LocalProdutoResumo & { blingId: string } => !!p.blingId)
        .map((p) => [p.blingId, p])
    );
    const porSku = new Map(
      produtosExistentes.map((p) => [normalizeSku(p.sku), p])
    );

    for (const resumo of blingProducts) {
      const skuBruto = BlingService.extractSKU(resumo);
      if (!skuBruto) {
        ignorados++;
        continue;
      }

      const sku = normalizeSku(skuBruto);
      const blingIdStr = String(resumo.id);

      try {
        const existentePorBlingId = porBlingId.get(blingIdStr);
        const existentePorSku = porSku.get(sku);

        if (
          existentePorBlingId &&
          existentePorSku &&
          existentePorBlingId.id !== existentePorSku.id
        ) {
          erros.push(
            `Conflito: SKU ${sku} já pertence a outro produto diferente do vinculado por blingId ${blingIdStr} — produto ignorado para evitar duplicidade.`
          );
          continue;
        }

        const existente = existentePorBlingId ?? existentePorSku ?? null;

        const detalhe = await BlingService.getProductById(accountId, resumo.id);

        const { fornecedorId, precoCusto: precoCustoFornecedor, codigo } =
          await resolverFornecedorPrincipalBling(accountId, resumo.id, userId);

        const { produtoId, criado } = await aplicarDetalheProdutoBling({
          userId,
          sku,
          blingIdStr,
          detalhe,
          existenteId: existente?.id ?? null,
          precoCustoFornecedorPadraoBling: precoCustoFornecedor,
        });

        if (criado) {
          criados++;
          porSku.set(sku, { id: produtoId, blingId: blingIdStr, sku });
          porBlingId.set(blingIdStr, { id: produtoId, blingId: blingIdStr, sku });
        } else {
          atualizados++;
        }

        if (fornecedorId && precoCustoFornecedor) {
          await vincularFornecedorProdutoBling(
            produtoId,
            fornecedorId,
            precoCustoFornecedor,
            codigo
          );
        }

        if (BlingService.isKit(detalhe)) {
          await sincronizarComponentesKitBling(
            produtoId,
            detalhe,
            async (blingIdComponente) =>
              porBlingId.get(blingIdComponente)?.id ?? null
          );
        }
      } catch (produtoError) {
        erros.push(
          `Produto ${sku}: ${
            produtoError instanceof Error
              ? produtoError.message
              : "erro desconhecido"
          }`
        );
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);

    await prisma.$transaction([
      prisma.blingSyncHistory.update({
        where: { id: syncHistoryId },
        data: {
          status: erros.length > 0 ? "partial" : "success",
          totalItems: blingProducts.length,
          syncedItems: criados + atualizados,
          newItems: criados,
          updatedItems: atualizados,
          errorItems: erros.length,
          errors: erros,
          completedAt: new Date(),
          duration,
        },
      }),
      prisma.blingAccount.update({
        where: { id: accountId },
        data: { ultimaSincronizacaoProdutos: new Date() },
      }),
    ]);
  } catch (error) {
    await prisma.blingSyncHistory.update({
      where: { id: syncHistoryId },
      data: {
        status: "error",
        errors: [error instanceof Error ? error.message : "Erro desconhecido"],
        completedAt: new Date(),
      },
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);

    const rateLimit = await checkRateLimit("bling-importar", user.id, 3, 300);
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

    const { accountId, completa } = parsed.data;

    const account = await prisma.blingAccount.findFirst({
      where: { id: accountId, userId: user.contaId },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Conta Bling não encontrada" },
        { status: 404 }
      );
    }

    if (!account.isActive) {
      throw new BlingReconnectError();
    }

    const dataAlteracaoInicial =
      !completa && account.ultimaSincronizacaoProdutos
        ? formatarDataBling(account.ultimaSincronizacaoProdutos)
        : undefined;

    const syncHistory = await prisma.blingSyncHistory.create({
      data: {
        blingAccountId: accountId,
        syncType: dataAlteracaoInicial ? "produtos_incremental" : "produtos_completa",
        status: "processing",
      },
    });

    after(async () => {
      await processarImportacao(
        accountId,
        user.contaId,
        dataAlteracaoInicial,
        syncHistory.id
      );
    });

    return NextResponse.json({
      iniciado: true,
      syncHistoryId: syncHistory.id,
    });
  } catch (error) {
    return blingErrorResponse(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);
    const syncHistoryId = searchParams.get("syncHistoryId");

    if (!syncHistoryId) {
      return NextResponse.json(
        { error: "syncHistoryId não fornecido" },
        { status: 400 }
      );
    }

    const syncHistory = await prisma.blingSyncHistory.findFirst({
      where: {
        id: syncHistoryId,
        blingAccount: { userId: user.contaId },
      },
    });

    if (!syncHistory) {
      return NextResponse.json(
        { error: "Histórico de sincronização não encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(syncHistory);
  } catch (error) {
    return blingErrorResponse(error);
  }
}
