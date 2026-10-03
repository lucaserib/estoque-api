import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { BlingService, BlingReconnectError } from "@/services/blingService";
import { blingErrorResponse } from "@/lib/blingApi";
import { resolverCustoProduto } from "@/lib/custo";
import { normalizeSku } from "@/lib/sku";
import { stringToBigIntEAN } from "@/utils/ean";
import { rehostTemporaryImage } from "@/lib/blingImageHost";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";

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

async function resolverFornecedorPrincipal(
  accountId: string,
  blingProdutoId: number,
  userId: string
): Promise<{
  fornecedorId: string | null;
  precoCusto: number | null;
}> {
  const fornecedores = await BlingService.getProductSuppliers(
    accountId,
    blingProdutoId
  );
  const padrao = fornecedores.find((f) => f.padrao) ?? fornecedores[0];
  if (!padrao) {
    return { fornecedorId: null, precoCusto: null };
  }

  const contato = await BlingService.getContact(
    accountId,
    padrao.fornecedor.id
  );

  const fornecedor = await prisma.fornecedor.upsert({
    where: {
      userId_blingContatoId: {
        userId,
        blingContatoId: String(contato.id),
      },
    },
    update: { nome: contato.nome, cnpj: contato.numeroDocumento },
    create: {
      userId,
      nome: contato.nome,
      cnpj: contato.numeroDocumento,
      blingContatoId: String(contato.id),
    },
  });

  return {
    fornecedorId: fornecedor.id,
    precoCusto: padrao.precoCompra ?? padrao.precoCusto ?? null,
  };
}

async function vincularFornecedorProduto(
  produtoId: string,
  fornecedorId: string,
  precoCusto: number,
  codigo: string | undefined
): Promise<void> {
  const precoCentavos = Math.round(precoCusto * 100);

  const vinculoExistente = await prisma.produtoFornecedor.findFirst({
    where: { produtoId, fornecedorId },
  });

  if (vinculoExistente) {
    await prisma.produtoFornecedor.update({
      where: { id: vinculoExistente.id },
      data: {
        preco: precoCentavos,
        precoUnitario: precoCentavos,
        codigoNoFornecedor: codigo,
        principal: true,
      },
    });
  } else {
    await prisma.produtoFornecedor.create({
      data: {
        produtoId,
        fornecedorId,
        preco: precoCentavos,
        precoUnitario: precoCentavos,
        multiplicador: 1,
        codigoNF: codigo ?? null,
        codigoNoFornecedor: codigo,
        principal: true,
      },
    });
  }

  await prisma.produtoFornecedor.updateMany({
    where: { produtoId, fornecedorId: { not: fornecedorId } },
    data: { principal: false },
  });
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
        const ean = stringToBigIntEAN(
          BlingService.extractEAN(detalhe) ?? undefined
        );
        const isKit = BlingService.isKit(detalhe);

        const { fornecedorId, precoCusto: precoCustoFornecedor } =
          await resolverFornecedorPrincipal(accountId, resumo.id, userId);

        const resultadoCusto = isKit
          ? { custoMedio: null, custoOrigem: null, preservado: false }
          : await resolverCustoProduto({
              produtoId: existente?.id,
              sku,
              userId,
              precoCustoFornecedorPadraoBling: precoCustoFornecedor,
              precoCustoProdutoBling: detalhe.precoCusto,
            });

        const imagemInfo = BlingService.extractImageInfo(detalhe);
        let imagemUrl = imagemInfo?.url ?? null;
        if (imagemInfo?.temporaria) {
          imagemUrl =
            (await rehostTemporaryImage(imagemInfo.url, sku)) ?? imagemInfo.url;
        }

        const dadosComuns = {
          nome: detalhe.nome,
          ean,
          marca: detalhe.marca ?? null,
          pesoGramas: detalhe.pesoBruto
            ? Math.round(detalhe.pesoBruto * 1000)
            : null,
          larguraCm: detalhe.dimensoes?.largura ?? null,
          alturaCm: detalhe.dimensoes?.altura ?? null,
          comprimentoCm: detalhe.dimensoes?.profundidade ?? null,
          precoVenda: detalhe.preco ? Math.round(detalhe.preco * 100) : null,
          precoOrigem: detalhe.preco ? ("BLING" as const) : null,
          blingId: blingIdStr,
          isKit,
          ativo: BlingService.isProductActive(detalhe),
          ...(imagemUrl ? { imagemUrl } : {}),
          ...(resultadoCusto.preservado
            ? {}
            : {
                custoMedio: resultadoCusto.custoMedio,
                custoOrigem: resultadoCusto.custoOrigem,
                custoAtualizadoEm:
                  resultadoCusto.custoMedio !== null ? new Date() : null,
              }),
        };

        const produto = existente
          ? await prisma.produto.update({
              where: { id: existente.id },
              data: dadosComuns,
            })
          : await prisma.produto.create({
              data: { ...dadosComuns, sku, userId },
            });

        if (existente) {
          atualizados++;
        } else {
          criados++;
          porSku.set(sku, { id: produto.id, blingId: blingIdStr, sku });
          porBlingId.set(blingIdStr, { id: produto.id, blingId: blingIdStr, sku });
        }

        if (fornecedorId && precoCustoFornecedor) {
          await vincularFornecedorProduto(
            produto.id,
            fornecedorId,
            precoCustoFornecedor,
            undefined
          );
        }

        if (isKit && detalhe.estrutura?.componentes) {
          for (const componenteBling of detalhe.estrutura.componentes) {
            const componenteLocal = porBlingId.get(
              String(componenteBling.produto.id)
            );
            if (!componenteLocal) continue;

            const vinculoExistente = await prisma.componente.findFirst({
              where: { kitId: produto.id, produtoId: componenteLocal.id },
            });

            if (vinculoExistente) {
              await prisma.componente.update({
                where: { id: vinculoExistente.id },
                data: { quantidade: componenteBling.quantidade },
              });
            } else {
              await prisma.componente.create({
                data: {
                  kitId: produto.id,
                  produtoId: componenteLocal.id,
                  quantidade: componenteBling.quantidade,
                },
              });
            }
          }
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
      where: { id: accountId, userId: user.id },
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
        user.id,
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
        blingAccount: { userId: user.id },
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
