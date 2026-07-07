import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { BlingService } from "@/services/blingService";
import { getProductCost } from "@/helpers/productCostHelper";

/**
 * POST /api/bling/produtos/importar
 * Importa produtos do Bling para o sistema local
 */
export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const body = await request.json();
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json(
        { error: "ID da conta Bling não fornecido" },
        { status: 400 }
      );
    }

    // Verificar se a conta pertence ao usuário
    const account = await prisma.blingAccount.findFirst({
      where: {
        id: accountId,
        userId: user.id,
        isActive: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Conta Bling não encontrada ou inativa" },
        { status: 404 }
      );
    }

    // Criar registro de sincronização
    const syncHistory = await prisma.blingSyncHistory.create({
      data: {
        blingAccountId: accountId,
        syncType: "produtos",
        status: "processing",
      },
    });

    const startTime = Date.now();

    try {
      // Obter token válido
      const accessToken = await BlingService.getValidToken(accountId);

      // Buscar produtos do Bling
      console.log("[BLING] Buscando produtos...");
      const blingProducts = await BlingService.getAllProducts(accessToken);

      console.log(`[BLING] ${blingProducts.length} produtos encontrados`);

      let newItems = 0;
      let updatedItems = 0;
      let errorItems = 0;
      const errors: string[] = [];

      // Processar cada produto
      for (const blingProduct of blingProducts) {
        try {
          const sku = BlingService.extractSKU(blingProduct);
          const ean = BlingService.extractEAN(blingProduct);

          // DEBUG: Log do primeiro produto para ver estrutura completa
          if (newItems === 0 && updatedItems === 0) {
            console.log("[BLING] 🔍 DEBUG - Estrutura do primeiro produto:");
            console.log(JSON.stringify(blingProduct, null, 2));
            console.log(`[BLING] 🔍 SKU extraído: ${sku}`);
            console.log(`[BLING] 🔍 EAN extraído: ${ean}`);
            console.log(`[BLING] 🔍 gtin: ${blingProduct.gtin}`);
            console.log(`[BLING] 🔍 gtinEmbalagem: ${blingProduct.gtinEmbalagem}`);
          }

          // Verificar se produto já existe
          const existingProduct = await prisma.produto.findFirst({
            where: {
              sku,
              userId: user.id,
            },
          });

          if (existingProduct) {
            // Buscar custo correto (Bling ou última compra)
            const custoMedio = await getProductCost(
              blingProduct.precoCusto,
              sku,
              user.id
            );

            // Atualizar produto existente
            await prisma.produto.update({
              where: { id: existingProduct.id },
              data: {
                nome: blingProduct.nome,
                ean: ean ? BigInt(ean) : null,
                custoMedio, // Atualizar custo médio
              },
            });

            updatedItems++;
            console.log(
              `[BLING] ✅ Produto ${sku} atualizado (custo: R$ ${(custoMedio / 100).toFixed(2)})`
            );
          } else {
            // Buscar custo correto (Bling ou última compra)
            const custoMedio = await getProductCost(
              blingProduct.precoCusto,
              sku,
              user.id
            );

            // Criar novo produto
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

            newItems++;
            console.log(
              `[BLING] ✅ Produto ${sku} criado (custo: R$ ${(custoMedio / 100).toFixed(2)})`
            );
          }
        } catch (productError) {
          errorItems++;
          const errorMsg = `Erro no produto ${blingProduct.codigo}: ${
            productError instanceof Error
              ? productError.message
              : "Erro desconhecido"
          }`;
          errors.push(errorMsg);
          console.error(`[BLING] ❌ ${errorMsg}`);
        }
      }

      const duration = Math.round((Date.now() - startTime) / 1000);

      // Atualizar histórico de sincronização
      await prisma.blingSyncHistory.update({
        where: { id: syncHistory.id },
        data: {
          status: errorItems > 0 ? "partial" : "success",
          totalItems: blingProducts.length,
          syncedItems: newItems + updatedItems,
          newItems,
          updatedItems,
          errorItems,
          errors: errors.length > 0 ? errors : [],
          completedAt: new Date(),
          duration,
        },
      });

      return NextResponse.json({
        success: true,
        summary: {
          total: blingProducts.length,
          new: newItems,
          updated: updatedItems,
          errors: errorItems,
          duration,
        },
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (syncError) {
      // Atualizar histórico com erro
      await prisma.blingSyncHistory.update({
        where: { id: syncHistory.id },
        data: {
          status: "error",
          errors: [
            syncError instanceof Error
              ? syncError.message
              : "Erro desconhecido",
          ],
          completedAt: new Date(),
        },
      });

      throw syncError;
    }
  } catch (error) {
    console.error("Erro ao importar produtos do Bling:", error);

    if (
      error instanceof Error &&
      error.message === "BLING_RECONNECT_REQUIRED"
    ) {
      return NextResponse.json(
        {
          error: "Sua conexão com o Bling expirou. Reconecte para continuar.",
          code: "BLING_RECONNECT_REQUIRED",
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao importar produtos do Bling",
      },
      { status: 500 }
    );
  }
}
