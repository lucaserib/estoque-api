import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { BlingService, BlingReconnectError } from "@/services/blingService";
import { blingErrorResponse } from "@/lib/blingApi";
import { getProductCost } from "@/helpers/productCostHelper";

const importarSchema = z.object({
  accountId: z.string().min(1, "ID da conta Bling não fornecido"),
});

export interface ImportacaoBlingResumo {
  criados: number;
  atualizados: number;
  ignorados: number;
  erros: string[];
}

export async function POST(request: NextRequest) {
  let syncHistoryId: string | null = null;

  try {
    const user = await verifyUser(request);
    const parsed = importarSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { accountId } = parsed.data;

    const account = await prisma.blingAccount.findFirst({
      where: {
        id: accountId,
        userId: user.id,
      },
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

    const syncHistory = await prisma.blingSyncHistory.create({
      data: {
        blingAccountId: accountId,
        syncType: "produtos",
        status: "processing",
      },
    });
    syncHistoryId = syncHistory.id;

    const startTime = Date.now();
    const accessToken = await BlingService.getValidToken(accountId);
    const blingProducts = await BlingService.getAllProducts(accessToken);

    const resumo: ImportacaoBlingResumo = {
      criados: 0,
      atualizados: 0,
      ignorados: 0,
      erros: [],
    };

    for (const blingProduct of blingProducts) {
      const sku = BlingService.extractSKU(blingProduct);

      if (!sku) {
        resumo.ignorados++;
        continue;
      }

      try {
        const ean = BlingService.extractEAN(blingProduct);
        const custoMedio = await getProductCost(
          blingProduct.precoCusto,
          sku,
          user.id
        );

        const existingProduct = await prisma.produto.findFirst({
          where: { sku, userId: user.id },
        });

        if (existingProduct) {
          await prisma.produto.update({
            where: { id: existingProduct.id },
            data: {
              nome: blingProduct.nome,
              ean: ean ? BigInt(ean) : null,
              custoMedio,
            },
          });
          resumo.atualizados++;
        } else {
          await prisma.produto.create({
            data: {
              nome: blingProduct.nome,
              sku,
              ean: ean ? BigInt(ean) : null,
              isKit: false,
              userId: user.id,
              custoMedio,
            },
          });
          resumo.criados++;
        }
      } catch (productError) {
        resumo.erros.push(
          `Produto ${sku}: ${
            productError instanceof Error
              ? productError.message
              : "erro desconhecido"
          }`
        );
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);

    await prisma.blingSyncHistory.update({
      where: { id: syncHistory.id },
      data: {
        status: resumo.erros.length > 0 ? "partial" : "success",
        totalItems: blingProducts.length,
        syncedItems: resumo.criados + resumo.atualizados,
        newItems: resumo.criados,
        updatedItems: resumo.atualizados,
        errorItems: resumo.erros.length,
        errors: resumo.erros,
        completedAt: new Date(),
        duration,
      },
    });

    return NextResponse.json({ success: true, ...resumo, duration });
  } catch (error) {
    if (syncHistoryId) {
      await prisma.blingSyncHistory
        .update({
          where: { id: syncHistoryId },
          data: {
            status: "error",
            errors: [
              error instanceof Error ? error.message : "Erro desconhecido",
            ],
            completedAt: new Date(),
          },
        })
        .catch(() => undefined);
    }

    return blingErrorResponse(error);
  }
}
