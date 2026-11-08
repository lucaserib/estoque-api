import { StatusIaAssinatura } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PRICING } from "@/lib/billing";
import { getOrCreateSubscription, isSubscriptionActive } from "@/lib/subscription";
import { somarMeses } from "@/modules/financeiro/dominio/periodo";
import { MercadoPagoService, type MercadoPagoPreapproval } from "@/services/mercadoPagoService";
import { assinaturaIaVigente } from "./acesso";

export const PREFIXO_REFERENCIA_IA = "ia:";

export class CobrancaIaError extends Error {
  constructor(
    message: string,
    readonly codigo: "TESTE_JA_USADO" | "JA_LIBERADA" | "ASSINATURA_PRINCIPAL" | "SEM_ASSINATURA_IA",
    readonly status = 409
  ) {
    super(message);
    this.name = "CobrancaIaError";
  }
}

export function referenciaIa(contaId: string): string {
  return `${PREFIXO_REFERENCIA_IA}${contaId}`;
}

export function contaDaReferenciaIa(referencia: string | null | undefined): string | null {
  return referencia?.startsWith(PREFIXO_REFERENCIA_IA) ? referencia.slice(PREFIXO_REFERENCIA_IA.length) || null : null;
}

function maisRecente(a: Date | null | undefined, b: Date): Date {
  return a && a.getTime() > b.getTime() ? a : b;
}

export async function iniciarTesteIa(contaId: string, agora: Date = new Date()) {
  const assinatura = await getOrCreateSubscription(contaId);
  if (assinatura.iaTesteIniciadoEm) {
    throw new CobrancaIaError("O teste grátis do Skubo IA já foi usado nesta conta.", "TESTE_JA_USADO");
  }
  if (assinatura.iaLiberadaManual || assinaturaIaVigente(assinatura, agora)) {
    throw new CobrancaIaError("O Skubo IA já está ativo nesta conta.", "JA_LIBERADA");
  }
  return prisma.subscription.update({
    where: { userId: contaId },
    data: { iaTesteIniciadoEm: agora, iaStatus: StatusIaAssinatura.TESTE },
  });
}

export async function assinarIa(contaId: string, email: string, origem: string): Promise<{ checkoutUrl: string }> {
  const assinatura = await getOrCreateSubscription(contaId);
  if (!isSubscriptionActive(assinatura)) {
    throw new CobrancaIaError(
      "Ative a assinatura do Skubo antes de contratar o Skubo IA.",
      "ASSINATURA_PRINCIPAL",
      402
    );
  }
  if (assinatura.iaStatus === StatusIaAssinatura.ATIVA) {
    throw new CobrancaIaError("O Skubo IA já está ativo nesta conta.", "JA_LIBERADA");
  }

  const preapproval = await MercadoPagoService.createPreapproval({
    reason: "Skubo IA — mensal",
    payerEmail: email,
    transactionAmount: PRICING.IA_MENSAL,
    frequency: 1,
    frequencyType: "months",
    backUrl: `${origem}/assinatura?recurso=ia`,
    externalReference: referenciaIa(contaId),
  });

  await prisma.subscription.update({
    where: { userId: contaId },
    data: { mpPreapprovalIaId: preapproval.id },
  });

  return { checkoutUrl: preapproval.init_point };
}

export async function cancelarIa(contaId: string) {
  const assinatura = await prisma.subscription.findUnique({ where: { userId: contaId } });
  if (!assinatura?.mpPreapprovalIaId || assinatura.iaStatus === StatusIaAssinatura.CANCELADA) {
    throw new CobrancaIaError("Não há assinatura do Skubo IA para cancelar.", "SEM_ASSINATURA_IA", 404);
  }
  await MercadoPagoService.cancelPreapproval(assinatura.mpPreapprovalIaId);
  return prisma.subscription.update({
    where: { userId: contaId },
    data: { iaStatus: StatusIaAssinatura.CANCELADA },
  });
}

export async function cancelarIaJuntoComPrincipal(contaId: string): Promise<boolean> {
  const assinatura = await prisma.subscription.findUnique({
    where: { userId: contaId },
    select: { mpPreapprovalIaId: true, iaStatus: true },
  });
  if (!assinatura?.mpPreapprovalIaId) return false;
  if (assinatura.iaStatus !== StatusIaAssinatura.ATIVA && assinatura.iaStatus !== StatusIaAssinatura.PENDENTE) return false;
  try {
    await MercadoPagoService.cancelPreapproval(assinatura.mpPreapprovalIaId);
  } catch (error) {
    console.error("[IA_COBRANCA] Falha ao cancelar a IA junto com a assinatura principal", {
      conta: contaId,
      erro: error instanceof Error ? error.name : "desconhecido",
    });
  }
  await prisma.subscription.update({ where: { userId: contaId }, data: { iaStatus: StatusIaAssinatura.CANCELADA } });
  return true;
}

async function assinaturaDoPreapproval(preapproval: Pick<MercadoPagoPreapproval, "id" | "external_reference">) {
  const porId = await prisma.subscription.findUnique({ where: { mpPreapprovalIaId: preapproval.id } });
  if (porId) return porId;
  const contaId = contaDaReferenciaIa(preapproval.external_reference);
  return contaId ? prisma.subscription.findUnique({ where: { userId: contaId } }) : null;
}

export function ehPreapprovalIa(preapproval: Pick<MercadoPagoPreapproval, "external_reference">): boolean {
  return contaDaReferenciaIa(preapproval.external_reference) !== null;
}

export async function processarPreapprovalIa(
  preapproval: Pick<MercadoPagoPreapproval, "id" | "status" | "external_reference">,
  agora: Date = new Date()
): Promise<StatusIaAssinatura | null> {
  const assinatura = await assinaturaDoPreapproval(preapproval);
  if (!assinatura) return null;

  if (preapproval.status === "authorized") {
    if (assinatura.iaStatus === StatusIaAssinatura.ATIVA && assinatura.mpPreapprovalIaId === preapproval.id) {
      return assinatura.iaStatus;
    }
    await prisma.subscription.update({
      where: { id: assinatura.id },
      data: {
        iaStatus: StatusIaAssinatura.ATIVA,
        mpPreapprovalIaId: preapproval.id,
        iaAtivadaEm: assinatura.iaAtivadaEm ?? agora,
        iaPeriodoFim: maisRecente(assinatura.iaPeriodoFim, somarMeses(agora, 1)),
      },
    });
    return StatusIaAssinatura.ATIVA;
  }

  if (assinatura.mpPreapprovalIaId && assinatura.mpPreapprovalIaId !== preapproval.id) return assinatura.iaStatus;

  if (preapproval.status === "cancelled" && assinatura.iaStatus !== StatusIaAssinatura.CANCELADA) {
    await prisma.subscription.update({ where: { id: assinatura.id }, data: { iaStatus: StatusIaAssinatura.CANCELADA } });
    return StatusIaAssinatura.CANCELADA;
  }
  if (preapproval.status === "paused" && assinatura.iaStatus === StatusIaAssinatura.ATIVA) {
    await prisma.subscription.update({ where: { id: assinatura.id }, data: { iaStatus: StatusIaAssinatura.PENDENTE } });
    return StatusIaAssinatura.PENDENTE;
  }
  return assinatura.iaStatus;
}

export async function processarPagamentoIa(
  pagamento: { status: string; external_reference: string | null; date_approved?: string | null },
  agora: Date = new Date()
): Promise<StatusIaAssinatura | null> {
  const contaId = contaDaReferenciaIa(pagamento.external_reference);
  if (!contaId) return null;
  const assinatura = await prisma.subscription.findUnique({ where: { userId: contaId } });
  if (!assinatura) return null;

  if (pagamento.status === "approved") {
    const aprovadoEm = pagamento.date_approved ? new Date(pagamento.date_approved) : agora;
    const fim = maisRecente(assinatura.iaPeriodoFim, somarMeses(Number.isNaN(aprovadoEm.getTime()) ? agora : aprovadoEm, 1));
    const status =
      assinatura.iaStatus === StatusIaAssinatura.CANCELADA ? StatusIaAssinatura.CANCELADA : StatusIaAssinatura.ATIVA;
    if (assinatura.iaStatus === status && assinatura.iaPeriodoFim?.getTime() === fim.getTime()) return status;
    await prisma.subscription.update({
      where: { id: assinatura.id },
      data: { iaStatus: status, iaPeriodoFim: fim, iaAtivadaEm: assinatura.iaAtivadaEm ?? agora },
    });
    return status;
  }

  if ((pagamento.status === "rejected" || pagamento.status === "cancelled") && assinatura.iaStatus === StatusIaAssinatura.ATIVA) {
    await prisma.subscription.update({ where: { id: assinatura.id }, data: { iaStatus: StatusIaAssinatura.PENDENTE } });
    return StatusIaAssinatura.PENDENTE;
  }
  return assinatura.iaStatus;
}
