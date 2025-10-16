import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { BlingService } from "@/services/blingService";
import { getProductCost } from "@/helpers/productCostHelper";

/**
 * POST /api/produtos/estoque-bling
 * Sincroniza estoque local com dados do Bling
 *
 * Fluxo:
 * 1. Busca conta Bling ativa do usuário
 * 2. Obtém estoque de todos os produtos do Bling
 * 3. Atualiza estoque local dos produtos vinculados por SKU
 * 4. Retorna resumo da sincronização
 */
export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);

    console.log("[BLING_SYNC] Iniciando sincronização de estoque");

    // 1. Buscar conta Bling ativa do usuário
    const blingAccount = await prisma.blingAccount.findFirst({
      where: {
        userId: user.id,
        isActive: true,
      },
    });

    if (!blingAccount) {
      return NextResponse.json(
        { error: "Conta Bling não encontrada. Configure a integração primeiro." },
        { status: 404 }
      );
    }

    // 2. Obter token válido (renova automaticamente se necessário)
    const accessToken = await BlingService.getValidToken(blingAccount.id);

    // 3. Buscar todos os produtos do usuário no sistema local
    const localProducts = await prisma.produto.findMany({
      where: {
        userId: user.id,
        isKit: false, // Kits não têm estoque direto
      },
      select: {
        id: true,
        sku: true,
        nome: true,
        estoques: {
          include: {
            armazem: true,
          },
        },
      },
    });

    if (localProducts.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Nenhum produto para sincronizar",
        stats: {
          total: 0,
          updated: 0,
          notFound: 0,
          errors: 0,
        },
      });
    }

    console.log(`[BLING_SYNC] ${localProducts.length} produtos locais para verificar`);

    // 4. Buscar estoque do Bling usando getAllProducts (já inclui estoque)
    // Isso é mais eficiente que buscar estoque separadamente
    const blingProducts = await BlingService.getAllProducts(accessToken);

    console.log(`[BLING_SYNC] ${blingProducts.length} produtos encontrados no Bling`);

    // 5. Criar mapa SKU -> dados do Bling (estoque + custo) para busca rápida
    const blingDataMap = new Map<
      string,
      { estoque: number; precoCusto: number | undefined }
    >();

    blingProducts.forEach((blingProduct) => {
      const sku = blingProduct.codigo;
      const estoque = blingProduct.estoque?.saldoFisicoTotal || 0;
      blingDataMap.set(sku, {
        estoque: Math.round(estoque),
        precoCusto: blingProduct.precoCusto,
      });
    });

    // 6. Buscar armazém padrão para sincronização
    let defaultWarehouse = await prisma.armazem.findFirst({
      where: {
        userId: user.id,
        nome: {
          contains: "Principal",
          mode: "insensitive",
        },
      },
    });

    // Se não encontrar "Principal", pegar o primeiro armazém
    if (!defaultWarehouse) {
      defaultWarehouse = await prisma.armazem.findFirst({
        where: { userId: user.id },
      });
    }

    // Se não existir nenhum armazém, criar um
    if (!defaultWarehouse) {
      defaultWarehouse = await prisma.armazem.create({
        data: {
          nome: "Armazém Principal",
          userId: user.id,
        },
      });
      console.log("[BLING_SYNC] Armazém padrão criado");
    }

    // 7. Sincronizar estoque produto por produto
    const stats = {
      total: localProducts.length,
      updated: 0,
      notFound: 0,
      errors: 0,
      details: [] as Array<{
        sku: string;
        nome: string;
        estoqueAnterior: number;
        estoqueNovo: number;
        status: "updated" | "not_found" | "error";
      }>,
    };

    for (const localProduct of localProducts) {
      try {
        const blingData = blingDataMap.get(localProduct.sku);

        if (blingData === undefined) {
          // Produto não encontrado no Bling
          stats.notFound++;
          stats.details.push({
            sku: localProduct.sku,
            nome: localProduct.nome,
            estoqueAnterior: localProduct.estoques.reduce(
              (sum, e) => sum + e.quantidade,
              0
            ),
            estoqueNovo: 0,
            status: "not_found",
          });
          console.log(
            `[BLING_SYNC] ⚠️  Produto ${localProduct.sku} não encontrado no Bling`
          );
          continue;
        }

        const { estoque: blingStock, precoCusto } = blingData;

        // Buscar custo correto (Bling ou última compra)
        const custoMedio = await getProductCost(
          precoCusto,
          localProduct.sku,
          user.id
        );

        // Atualizar produto com custo médio
        await prisma.produto.update({
          where: { id: localProduct.id },
          data: { custoMedio },
        });

        // Buscar ou criar registro de estoque no armazém padrão
        const estoqueAnterior =
          localProduct.estoques.find(
            (e) => e.armazemId === defaultWarehouse!.id
          )?.quantidade || 0;

        await prisma.estoque.upsert({
          where: {
            produtoId_armazemId: {
              produtoId: localProduct.id,
              armazemId: defaultWarehouse.id,
            },
          },
          update: {
            quantidade: blingStock,
          },
          create: {
            produtoId: localProduct.id,
            armazemId: defaultWarehouse.id,
            quantidade: blingStock,
          },
        });

        stats.updated++;
        stats.details.push({
          sku: localProduct.sku,
          nome: localProduct.nome,
          estoqueAnterior,
          estoqueNovo: blingStock,
          status: "updated",
        });

        console.log(
          `[BLING_SYNC] ✅ ${localProduct.sku}: ${estoqueAnterior} → ${blingStock} | Custo: R$ ${(custoMedio / 100).toFixed(2)}`
        );
      } catch (error) {
        stats.errors++;
        stats.details.push({
          sku: localProduct.sku,
          nome: localProduct.nome,
          estoqueAnterior: 0,
          estoqueNovo: 0,
          status: "error",
        });
        console.error(`[BLING_SYNC] ❌ Erro ao atualizar ${localProduct.sku}:`, error);
      }

      // Rate limiting: aguardar 100ms entre atualizações
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log("[BLING_SYNC] Sincronização concluída");
    console.log(`[BLING_SYNC] Atualizados: ${stats.updated}/${stats.total}`);
    console.log(`[BLING_SYNC] Não encontrados: ${stats.notFound}`);
    console.log(`[BLING_SYNC] Erros: ${stats.errors}`);

    return NextResponse.json({
      success: true,
      message: `Estoque sincronizado com sucesso! ${stats.updated} produtos atualizados.`,
      stats: {
        total: stats.total,
        updated: stats.updated,
        notFound: stats.notFound,
        errors: stats.errors,
      },
      armazem: {
        id: defaultWarehouse.id,
        nome: defaultWarehouse.nome,
      },
      details: stats.details,
    });
  } catch (error) {
    console.error("[BLING_SYNC] Erro ao sincronizar estoque:", error);

    return NextResponse.json(
      {
        error: "Erro ao sincronizar estoque do Bling",
        message: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}
