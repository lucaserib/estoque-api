import type { ReajusteAssinatura, SubscriptionPlan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { enviarEmailSemFalhar } from "@/modules/email/enviar";
import { MercadoPagoService, centavosParaReais } from "@/services/mercadoPagoService";
import { VALOR_MINIMO_COBRANCA_CENTAVOS } from "./cupons";

const DIA_MS = 24 * 60 * 60 * 1000;
export const ANTECEDENCIA_MINIMA_DIAS = 30;
const NOME_PLANO: Record<SubscriptionPlan, string> = { MONTHLY: "Mensal", ANNUAL: "Anual" };

export class ReajusteInvalidoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReajusteInvalidoError";
  }
}

function filtroAfetados(plano: SubscriptionPlan) {
  return { status: "ACTIVE" as const, plan: plano, mpPreapprovalId: { not: null } };
}

export async function contarAfetados(plano: SubscriptionPlan, novoPrecoCentavos: number): Promise<number> {
  return prisma.subscription.count({
    where: { ...filtroAfetados(plano), NOT: { precoContratadoCentavos: novoPrecoCentavos } },
  });
}

export async function agendarReajuste(
  entrada: { plano: SubscriptionPlan; novoPrecoCentavos: number; aplicarEm: Date; motivo: string },
  adminEmail: string,
  agora: Date = new Date()
): Promise<ReajusteAssinatura> {
  if (!Number.isInteger(entrada.novoPrecoCentavos) || entrada.novoPrecoCentavos < VALOR_MINIMO_COBRANCA_CENTAVOS) {
    throw new ReajusteInvalidoError("Informe um preço válido.");
  }
  if (entrada.aplicarEm.getTime() < agora.getTime() + ANTECEDENCIA_MINIMA_DIAS * DIA_MS - 60_000) {
    throw new ReajusteInvalidoError(`O reajuste precisa ser avisado com pelo menos ${ANTECEDENCIA_MINIMA_DIAS} dias de antecedência.`);
  }
  if (!entrada.motivo.trim()) throw new ReajusteInvalidoError("Explique o motivo do reajuste: ele vai no e-mail aos clientes.");
  const pendente = await prisma.reajusteAssinatura.findFirst({ where: { plano: entrada.plano, status: "AGENDADO" } });
  if (pendente) throw new ReajusteInvalidoError("Já existe um reajuste agendado para este plano. Cancele-o antes de agendar outro.");

  const afetadas = await prisma.subscription.findMany({
    where: { ...filtroAfetados(entrada.plano), NOT: { precoContratadoCentavos: entrada.novoPrecoCentavos } },
    select: { userId: true, precoContratadoCentavos: true, user: { select: { id: true, name: true, email: true } } },
  });

  const reajuste = await prisma.reajusteAssinatura.create({
    data: {
      plano: entrada.plano,
      novoPrecoCentavos: entrada.novoPrecoCentavos,
      aplicarEm: entrada.aplicarEm,
      motivo: entrada.motivo.trim(),
      criadoPor: adminEmail,
      afetados: afetadas.length,
    },
  });

  let avisados = 0;
  for (const assinatura of afetadas) {
    const resultado = await enviarEmailSemFalhar({
      para: assinatura.user.email,
      modelo: "aviso-reajuste",
      dados: {
        nome: assinatura.user.name,
        plano: NOME_PLANO[entrada.plano],
        precoAtualCentavos: assinatura.precoContratadoCentavos ?? 0,
        novoPrecoCentavos: entrada.novoPrecoCentavos,
        aplicarEm: entrada.aplicarEm,
        motivo: entrada.motivo.trim(),
      },
      chaveIdempotencia: `aviso-reajuste:${reajuste.id}:${assinatura.userId}`,
      userId: assinatura.user.id,
      contaId: assinatura.userId,
    });
    if (resultado) avisados++;
  }
  return prisma.reajusteAssinatura.update({ where: { id: reajuste.id }, data: { avisados } });
}

export async function cancelarReajuste(id: string): Promise<ReajusteAssinatura> {
  const reajuste = await prisma.reajusteAssinatura.findUnique({ where: { id } });
  if (!reajuste || reajuste.status !== "AGENDADO") throw new ReajusteInvalidoError("Só dá para cancelar um reajuste agendado.");
  return prisma.reajusteAssinatura.update({ where: { id }, data: { status: "CANCELADO" } });
}

export async function aplicarReajustesVencidos(agora: Date = new Date(), orcamentoMs = 45_000): Promise<{ reajustes: number; aplicados: number; falhas: number }> {
  const prazo = Date.now() + orcamentoMs;
  const vencidos = await prisma.reajusteAssinatura.findMany({ where: { status: "AGENDADO", aplicarEm: { lte: agora } } });
  let aplicados = 0;
  let falhas = 0;

  for (const reajuste of vencidos) {
    const assinaturas = await prisma.subscription.findMany({
      where: { ...filtroAfetados(reajuste.plano), NOT: { precoContratadoCentavos: reajuste.novoPrecoCentavos } },
      select: { id: true, mpPreapprovalId: true, descontoAplicadoCentavos: true },
    });
    let falhasDoReajuste = 0;
    for (const assinatura of assinaturas) {
      if (Date.now() > prazo) {
        falhasDoReajuste++;
        break;
      }
      try {
        if (!assinatura.descontoAplicadoCentavos) {
          await MercadoPagoService.updatePreapprovalAmount(assinatura.mpPreapprovalId!, centavosParaReais(reajuste.novoPrecoCentavos));
        }
        await prisma.subscription.update({ where: { id: assinatura.id }, data: { precoContratadoCentavos: reajuste.novoPrecoCentavos } });
        aplicados++;
      } catch (error) {
        falhasDoReajuste++;
        console.error(`[REAJUSTE] Falha na assinatura ${assinatura.id}:`, error);
      }
    }
    falhas += falhasDoReajuste;
    const restantes = await contarAfetados(reajuste.plano, reajuste.novoPrecoCentavos);
    await prisma.reajusteAssinatura.update({
      where: { id: reajuste.id },
      data: {
        aplicados: { increment: assinaturas.length - falhasDoReajuste },
        falhas: falhasDoReajuste,
        ...(restantes === 0 ? { status: "APLICADO" as const, aplicadoEm: agora } : {}),
      },
    });
  }
  return { reajustes: vencidos.length, aplicados, falhas };
}
