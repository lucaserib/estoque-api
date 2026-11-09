import type { CreditoDiasAssinatura, Subscription } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { invalidarSituacaoConta } from "@/modules/conta/situacao";
import { MercadoPagoService, centavosParaReais } from "@/services/mercadoPagoService";
import { VALOR_MINIMO_COBRANCA_CENTAVOS } from "@/modules/comercial/cupons";

const DIA_MS = 24 * 60 * 60 * 1000;
export const DIAS_ANTES_DA_COBRANCA = 3;
export const DIAS_CICLO_MENSAL = 30;

function somarDias(data: Date, dias: number): Date {
  return new Date(data.getTime() + dias * DIA_MS);
}

export function descontoMensal(precoCentavos: number, dias: number): number {
  return Math.round((precoCentavos * dias) / DIAS_CICLO_MENSAL);
}

export function descontoAnual(precoCentavos: number, dias: number): number {
  return Math.round((precoCentavos * dias) / 365);
}

export type FormaAplicada = "EXTENSAO_TESTE" | "EXTENSAO_ANUAL" | "PENDENTE";

export async function aplicarCreditoNaHora(
  credito: Pick<CreditoDiasAssinatura, "id" | "contaId" | "dias">,
  agora: Date = new Date()
): Promise<FormaAplicada> {
  const assinatura = await prisma.subscription.findUnique({ where: { userId: credito.contaId } });

  if (assinatura?.status === "TRIALING" && assinatura.trialEndsAt.getTime() > agora.getTime()) {
    await prisma.$transaction([
      prisma.subscription.update({
        where: { id: assinatura.id },
        data: { trialEndsAt: somarDias(assinatura.trialEndsAt, credito.dias) },
      }),
      prisma.creditoDiasAssinatura.update({
        where: { id: credito.id },
        data: { forma: "EXTENSAO_TESTE", aplicadoEm: agora, detalhe: { testeAntes: assinatura.trialEndsAt.toISOString() } },
      }),
    ]);
    invalidarSituacaoConta(credito.contaId);
    return "EXTENSAO_TESTE";
  }

  if (assinatura?.status === "ACTIVE" && assinatura.plan === "ANNUAL" && assinatura.currentPeriodEnd) {
    await prisma.$transaction([
      prisma.subscription.update({
        where: { id: assinatura.id },
        data: { currentPeriodEnd: somarDias(assinatura.currentPeriodEnd, credito.dias) },
      }),
      prisma.creditoDiasAssinatura.update({
        where: { id: credito.id },
        data: {
          forma: "EXTENSAO_ANUAL",
          aplicadoEm: agora,
          detalhe: { periodoAntes: assinatura.currentPeriodEnd.toISOString(), descontoNaRenovacao: false },
        },
      }),
    ]);
    invalidarSituacaoConta(credito.contaId);
    return "EXTENSAO_ANUAL";
  }

  return "PENDENTE";
}

export interface ResultadoCicloRecompensa {
  verificadas: number;
  descontos: number;
  pausas: number;
  reativadas: number;
  renovacoesAnuais: number;
  erros: number;
}

function proximaCobranca(assinatura: Subscription, lida: string | null | undefined): Date | null {
  if (lida) return new Date(lida);
  return assinatura.currentPeriodEnd;
}

async function consumirParaPausa(creditos: CreditoDiasAssinatura[], agora: Date): Promise<boolean> {
  let acumulado = 0;
  const usados: CreditoDiasAssinatura[] = [];
  for (const credito of creditos) {
    if (acumulado >= DIAS_CICLO_MENSAL) break;
    usados.push(credito);
    acumulado += credito.dias;
  }
  if (acumulado < DIAS_CICLO_MENSAL) return false;
  const sobra = acumulado - DIAS_CICLO_MENSAL;
  await prisma.$transaction([
    ...usados.map((credito) =>
      prisma.creditoDiasAssinatura.update({
        where: { id: credito.id },
        data: { forma: "CICLO_PAUSADO", aplicadoEm: agora },
      })
    ),
    ...(sobra > 0
      ? [
          prisma.creditoDiasAssinatura.create({
            data: {
              contaId: usados[0].contaId,
              dias: sobra,
              origem: usados[usados.length - 1].origem,
              descricao: "Sobra de dias depois de pular uma cobrança",
            },
          }),
        ]
      : []),
  ]);
  return true;
}

export async function processarAssinaturaComCreditos(
  assinatura: Subscription,
  agora: Date = new Date()
): Promise<"DESCONTO" | "PAUSA" | "RENOVACAO_ANUAL" | "NADA"> {
  if (assinatura.status !== "ACTIVE" || !assinatura.mpPreapprovalId || assinatura.pausadaAte) return "NADA";
  if (assinatura.descontoAplicadoCentavos) return "NADA";
  const preco = assinatura.precoContratadoCentavos;
  if (!preco) return "NADA";

  const preapproval = await MercadoPagoService.getPreapproval(assinatura.mpPreapprovalId);
  const proxima = proximaCobranca(assinatura, preapproval.next_payment_date);
  if (proxima) {
    await prisma.subscription.update({ where: { id: assinatura.id }, data: { proximaCobrancaEm: proxima } });
  }
  if (!proxima || proxima.getTime() - agora.getTime() > DIAS_ANTES_DA_COBRANCA * DIA_MS) return "NADA";

  if (assinatura.plan === "ANNUAL") {
    const anuais = await prisma.creditoDiasAssinatura.findMany({
      where: { contaId: assinatura.userId, forma: "EXTENSAO_ANUAL" },
    });
    const pendentesDeDesconto = anuais.filter((c) => !(c.detalhe as { descontoNaRenovacao?: boolean } | null)?.descontoNaRenovacao);
    const dias = pendentesDeDesconto.reduce((t, c) => t + c.dias, 0);
    if (dias === 0) return "NADA";
    const desconto = Math.min(descontoAnual(preco, dias), preco - VALOR_MINIMO_COBRANCA_CENTAVOS);
    if (desconto <= 0) return "NADA";
    await MercadoPagoService.updatePreapprovalAmount(assinatura.mpPreapprovalId, centavosParaReais(preco - desconto));
    await prisma.$transaction([
      prisma.subscription.update({ where: { id: assinatura.id }, data: { descontoAplicadoCentavos: desconto } }),
      ...pendentesDeDesconto.map((c) =>
        prisma.creditoDiasAssinatura.update({
          where: { id: c.id },
          data: { detalhe: { ...((c.detalhe as object | null) ?? {}), descontoNaRenovacao: true, descontoCentavos: desconto } },
        })
      ),
    ]);
    return "RENOVACAO_ANUAL";
  }

  const pendentes = await prisma.creditoDiasAssinatura.findMany({
    where: { contaId: assinatura.userId, forma: "PENDENTE" },
    orderBy: { createdAt: "asc" },
  });
  const dias = pendentes.reduce((t, c) => t + c.dias, 0);
  if (dias === 0) return "NADA";

  if (dias >= DIAS_CICLO_MENSAL) {
    const pausadaAte = somarDias(proxima, DIAS_CICLO_MENSAL);
    await MercadoPagoService.pausarPreapproval(assinatura.mpPreapprovalId);
    const consumiu = await consumirParaPausa(pendentes, agora);
    if (!consumiu) return "NADA";
    await prisma.subscription.update({
      where: { id: assinatura.id },
      data: {
        pausadaAte,
        currentPeriodEnd: somarDias(assinatura.currentPeriodEnd ?? proxima, DIAS_CICLO_MENSAL),
      },
    });
    invalidarSituacaoConta(assinatura.userId);
    return "PAUSA";
  }

  const desconto = descontoMensal(preco, dias);
  if (preco - desconto < VALOR_MINIMO_COBRANCA_CENTAVOS) return "NADA";
  await MercadoPagoService.updatePreapprovalAmount(assinatura.mpPreapprovalId, centavosParaReais(preco - desconto));
  await prisma.$transaction([
    prisma.subscription.update({ where: { id: assinatura.id }, data: { descontoAplicadoCentavos: desconto } }),
    ...pendentes.map((c) =>
      prisma.creditoDiasAssinatura.update({
        where: { id: c.id },
        data: { forma: "DESCONTO_PROXIMA_COBRANCA", aplicadoEm: agora, detalhe: { descontoCentavos: desconto, cobrancaEm: proxima.toISOString() } },
      })
    ),
  ]);
  return "DESCONTO";
}

export async function restaurarPrecoDepoisDoDesconto(assinatura: Subscription): Promise<boolean> {
  if (!assinatura.descontoAplicadoCentavos || !assinatura.mpPreapprovalId || !assinatura.precoContratadoCentavos) return false;
  await MercadoPagoService.updatePreapprovalAmount(assinatura.mpPreapprovalId, centavosParaReais(assinatura.precoContratadoCentavos));
  await prisma.subscription.update({ where: { id: assinatura.id }, data: { descontoAplicadoCentavos: null } });
  return true;
}

export async function reativarPausadas(agora: Date = new Date()): Promise<number> {
  const pausadas = await prisma.subscription.findMany({
    where: { pausadaAte: { lte: agora }, mpPreapprovalId: { not: null } },
  });
  let reativadas = 0;
  for (const assinatura of pausadas) {
    try {
      await MercadoPagoService.reativarPreapproval(assinatura.mpPreapprovalId!);
      await prisma.subscription.update({ where: { id: assinatura.id }, data: { pausadaAte: null } });
      reativadas++;
    } catch (error) {
      console.error(`[RECOMPENSAS] Falha ao reativar a assinatura ${assinatura.id}:`, error);
    }
  }
  return reativadas;
}

export async function processarRecompensasDeAssinatura(agora: Date = new Date(), orcamentoMs = 45_000): Promise<ResultadoCicloRecompensa> {
  const prazo = Date.now() + orcamentoMs;
  const resultado: ResultadoCicloRecompensa = { verificadas: 0, descontos: 0, pausas: 0, reativadas: 0, renovacoesAnuais: 0, erros: 0 };
  resultado.reativadas = await reativarPausadas(agora);

  const contasComCredito = await prisma.creditoDiasAssinatura.findMany({
    where: { OR: [{ forma: "PENDENTE" }, { forma: "EXTENSAO_ANUAL" }] },
    select: { contaId: true },
    distinct: ["contaId"],
  });
  const assinaturas = await prisma.subscription.findMany({
    where: { userId: { in: contasComCredito.map((c) => c.contaId) }, status: "ACTIVE", mpPreapprovalId: { not: null } },
  });

  for (const assinatura of assinaturas) {
    if (Date.now() > prazo) break;
    resultado.verificadas++;
    try {
      const feito = await processarAssinaturaComCreditos(assinatura, agora);
      if (feito === "DESCONTO") resultado.descontos++;
      if (feito === "PAUSA") resultado.pausas++;
      if (feito === "RENOVACAO_ANUAL") resultado.renovacoesAnuais++;
    } catch (error) {
      resultado.erros++;
      console.error(`[RECOMPENSAS] Falha na assinatura ${assinatura.id}:`, error);
    }
  }
  return resultado;
}
