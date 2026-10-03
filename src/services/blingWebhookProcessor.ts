import { prisma } from "@/lib/prisma";
import {
  inativarProdutoPorBlingId,
  sincronizarEstoqueUnico,
  sincronizarFornecedorUnico,
  sincronizarProdutoUnico,
} from "@/services/blingProductSync";

export interface BlingWebhookEnvelope {
  eventId: string;
  date: string;
  version: string;
  event: string;
  companyId: string;
  data: Record<string, unknown>;
}

export function extrairBlingProdutoId(
  evento: string,
  data: Record<string, unknown>
): string | null {
  if (evento.startsWith("product.")) {
    const id = data.id;
    return typeof id === "number" || typeof id === "string" ? String(id) : null;
  }

  const produto = data.produto as Record<string, unknown> | undefined;
  if (produto?.id !== undefined) return String(produto.id);
  if (data.idProduto !== undefined) return String(data.idProduto);
  if (data.produtoId !== undefined) return String(data.produtoId);
  return null;
}

export async function processarEventoWebhookBling(eventoId: string): Promise<void> {
  const evento = await prisma.blingWebhookEvent.findUnique({ where: { id: eventoId } });
  if (!evento || evento.processado) return;

  try {
    const payload = evento.payload as unknown as BlingWebhookEnvelope;
    const account = await prisma.blingAccount.findFirst({
      where: { blingCompanyId: payload.companyId, isActive: true },
    });

    if (!account) {
      await prisma.blingWebhookEvent.update({
        where: { id: eventoId },
        data: {
          processado: true,
          processadoEm: new Date(),
          erro: "Conta não encontrada para este companyId",
        },
      });
      return;
    }

    const blingProdutoId = extrairBlingProdutoId(payload.event, payload.data);
    if (!blingProdutoId) {
      await prisma.blingWebhookEvent.update({
        where: { id: eventoId },
        data: {
          processado: true,
          processadoEm: new Date(),
          erro: "Não foi possível extrair o id do produto do payload",
        },
      });
      return;
    }

    if (payload.event === "product.deleted") {
      await inativarProdutoPorBlingId(account.userId, blingProdutoId);
    } else if (payload.event.startsWith("product.")) {
      await sincronizarProdutoUnico(account.id, account.userId, Number(blingProdutoId));
    } else if (
      payload.event.startsWith("stock.") ||
      payload.event.startsWith("virtual_stock.")
    ) {
      await sincronizarEstoqueUnico(account.id, account.userId, Number(blingProdutoId));
    } else if (payload.event.startsWith("product_supplier.")) {
      await sincronizarFornecedorUnico(account.id, account.userId, Number(blingProdutoId));
    }

    await prisma.blingWebhookEvent.update({
      where: { id: eventoId },
      data: { processado: true, processadoEm: new Date(), erro: null },
    });
  } catch (error) {
    await prisma.blingWebhookEvent.update({
      where: { id: eventoId },
      data: { erro: error instanceof Error ? error.message : "Erro desconhecido" },
    });
  }
}
