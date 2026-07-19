import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { BlingService, BlingReconnectError } from "@/services/blingService";
import { blingErrorResponse } from "@/lib/blingApi";
import { getProductCost } from "@/helpers/productCostHelper";

interface SyncDetail {
  sku: string;
  nome: string;
  estoqueAnterior: number;
  estoqueNovo: number;
  status: "updated" | "not_found" | "error";
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);

    const blingAccount = await prisma.blingAccount.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    if (!blingAccount) {
      return NextResponse.json(
        {
          error:
            "Conta Bling não encontrada. Configure a integração primeiro.",
        },
        { status: 404 }
      );
    }

    if (!blingAccount.isActive) {
      throw new BlingReconnectError();
    }

    const accessToken = await BlingService.getValidToken(blingAccount.id);

    const localProducts = await prisma.produto.findMany({
      where: {
        userId: user.id,
        isKit: false,
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
        stats: { total: 0, updated: 0, notFound: 0, errors: 0 },
      });
    }

    const blingProducts = await BlingService.getAllProducts(accessToken);

    const blingDataMap = new Map<
      string,
      { estoque: number; precoCusto: number | undefined }
    >();

    blingProducts.forEach((blingProduct) => {
      blingDataMap.set(blingProduct.codigo, {
        estoque: Math.round(blingProduct.estoque?.saldoFisicoTotal || 0),
        precoCusto: blingProduct.precoCusto,
      });
    });

    let defaultWarehouse = await prisma.armazem.findFirst({
      where: {
        userId: user.id,
        nome: { contains: "Principal", mode: "insensitive" },
      },
    });

    if (!defaultWarehouse) {
      defaultWarehouse = await prisma.armazem.findFirst({
        where: { userId: user.id },
      });
    }

    if (!defaultWarehouse) {
      defaultWarehouse = await prisma.armazem.create({
        data: {
          nome: "Armazém Principal",
          userId: user.id,
        },
      });
    }

    const stats = {
      total: localProducts.length,
      updated: 0,
      notFound: 0,
      errors: 0,
      details: [] as SyncDetail[],
    };

    for (const localProduct of localProducts) {
      try {
        const blingData = blingDataMap.get(localProduct.sku);

        if (blingData === undefined) {
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
          continue;
        }

        const { estoque: blingStock, precoCusto } = blingData;

        const custoMedio = await getProductCost(
          precoCusto,
          localProduct.sku,
          user.id
        );

        await prisma.produto.update({
          where: { id: localProduct.id },
          data: { custoMedio },
        });

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
          update: { quantidade: blingStock },
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
      } catch (error) {
        stats.errors++;
        stats.details.push({
          sku: localProduct.sku,
          nome: localProduct.nome,
          estoqueAnterior: 0,
          estoqueNovo: 0,
          status: "error",
        });
        console.error(
          `[BLING_SYNC] Erro ao atualizar ${localProduct.sku}:`,
          error
        );
      }
    }

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
    return blingErrorResponse(error);
  }
}
