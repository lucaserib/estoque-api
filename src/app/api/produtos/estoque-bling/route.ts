import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { BlingService, BlingReconnectError, BlingProduct } from "@/services/blingService";
import { blingErrorResponse } from "@/lib/blingApi";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { normalizeSku } from "@/lib/sku";
import {
  aplicarEstoqueProdutoBling,
  garantirArmazensParaDepositos,
} from "@/services/blingProductSync";

interface SyncDetail {
  sku: string;
  nome: string;
  armazem: string;
  quantidadeAnterior: number;
  quantidadeNova: number;
  status: "atualizado" | "sem_mudanca" | "nao_encontrado" | "erro";
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);

    const rateLimit = await checkRateLimit("bling-estoque", user.id, 5, 300);
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit);
    }

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

    const localProducts = await prisma.produto.findMany({
      where: { userId: user.id, isKit: false },
      select: {
        id: true,
        sku: true,
        nome: true,
        blingId: true,
        estoques: { select: { armazemId: true, quantidade: true } },
      },
    });

    if (localProducts.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Nenhum produto para sincronizar",
        stats: { total: 0, atualizados: 0, naoEncontrados: 0, erros: 0 },
        detalhes: [],
      });
    }

    const blingProducts = await BlingService.getAllProducts(blingAccount.id);
    const blingById = new Map(blingProducts.map((p) => [p.id, p]));
    const blingByNormalizedSku = new Map(
      blingProducts.map((p) => [normalizeSku(p.codigo), p])
    );

    const matched: Array<{
      local: (typeof localProducts)[number];
      bling: BlingProduct;
    }> = [];
    const detalhes: SyncDetail[] = [];
    let naoEncontrados = 0;

    for (const local of localProducts) {
      const bling =
        (local.blingId ? blingById.get(Number(local.blingId)) : undefined) ??
        blingByNormalizedSku.get(normalizeSku(local.sku));

      if (!bling) {
        naoEncontrados++;
        detalhes.push({
          sku: local.sku,
          nome: local.nome,
          armazem: "",
          quantidadeAnterior: local.estoques.reduce(
            (soma, e) => soma + e.quantidade,
            0
          ),
          quantidadeNova: 0,
          status: "nao_encontrado",
        });
        continue;
      }

      matched.push({ local, bling });
    }

    const armazemPorDeposito = await garantirArmazensParaDepositos(
      blingAccount.id,
      user.id
    );

    const blingIds = matched.map((m) => m.bling.id);
    const stockItems = await BlingService.getStockForProducts(
      blingAccount.id,
      blingIds
    );
    const stockByBlingId = new Map(stockItems.map((s) => [s.produto.id, s]));

    let atualizados = 0;
    let erros = 0;

    for (const { local, bling } of matched) {
      try {
        if (!local.blingId) {
          await prisma.produto.update({
            where: { id: local.id },
            data: { blingId: String(bling.id) },
          });
        }

        const stock = stockByBlingId.get(bling.id);
        if (!stock) {
          naoEncontrados++;
          detalhes.push({
            sku: local.sku,
            nome: local.nome,
            armazem: "",
            quantidadeAnterior: local.estoques.reduce(
              (soma, e) => soma + e.quantidade,
              0
            ),
            quantidadeNova: 0,
            status: "nao_encontrado",
          });
          continue;
        }

        const resultadosDeposito = await aplicarEstoqueProdutoBling({
          userId: user.id,
          produtoLocalId: local.id,
          depositosSaldo: stock.depositos,
          armazemPorDeposito,
          estoquesAtuais: local.estoques,
        });

        for (const resultado of resultadosDeposito) {
          if (resultado.mudou) atualizados++;
          detalhes.push({
            sku: local.sku,
            nome: local.nome,
            armazem: resultado.armazemNome,
            quantidadeAnterior: resultado.quantidadeAnterior,
            quantidadeNova: resultado.quantidadeNova,
            status: resultado.mudou ? "atualizado" : "sem_mudanca",
          });
        }
      } catch (error) {
        erros++;
        detalhes.push({
          sku: local.sku,
          nome: local.nome,
          armazem: "",
          quantidadeAnterior: 0,
          quantidadeNova: 0,
          status: "erro",
        });
        console.error(`[BLING_SYNC] Erro ao atualizar ${local.sku}:`, error);
      }
    }

    await prisma.blingAccount.update({
      where: { id: blingAccount.id },
      data: { ultimaSincronizacaoEstoque: new Date() },
    });

    return NextResponse.json({
      success: true,
      message: `Estoque sincronizado! ${atualizados} divergência(s) corrigida(s).`,
      stats: {
        total: localProducts.length,
        atualizados,
        naoEncontrados,
        erros,
      },
      detalhes,
    });
  } catch (error) {
    return blingErrorResponse(error);
  }
}
