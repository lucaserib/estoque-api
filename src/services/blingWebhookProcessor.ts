import { prisma } from "@/lib/prisma";
import { BlingApiError, BlingEscopoError } from "@/services/blingService";
import {
  inativarProdutoPorBlingId,
  sincronizarEstoqueUnico,
  sincronizarFornecedorUnico,
  sincronizarProdutoUnico,
  BlingProdutoIgnorado,
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
    const mensagem = error instanceof Error ? error.message : "Erro desconhecido";
    // Erro que nunca vai passar (produto apagado no Bling, sem SKU, SKU
    // duplicado) fecha o evento; senão ele era reprocessado todo dia para
    // sempre e ocupava a vez dos eventos novos no cron (limite de 200).
    const permanente = erroPermanenteBling(error);
    await prisma.blingWebhookEvent.update({
      where: { id: eventoId },
      data: permanente
        ? { processado: true, processadoEm: new Date(), erro: `Descartado: ${mensagem}`.slice(0, 1000) }
        : { erro: mensagem.slice(0, 1000) },
    });
  }
}

export function erroPermanenteBling(error: unknown): boolean {
  if (error instanceof BlingEscopoError) return false;
  if (error instanceof BlingProdutoIgnorado) return true;
  if (error instanceof BlingApiError) return [400, 404, 410, 422].includes(error.status);
  if (!(error instanceof Error)) return false;
  return /sem SKU|já pertence ao produto/i.test(error.message);
}
