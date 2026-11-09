import { Prisma, type Subscription } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { obterConfiguracaoComercial, precoDoPlano } from "@/modules/comercial/configuracao";
import { registrarEvento } from "@/modules/clientes/eventos";
import { invalidarSituacaoConta } from "@/modules/conta/situacao";
import { enviarEmailSemFalhar } from "@/modules/email/enviar";
import { dispararAutomacao } from "@/modules/email/automacoes";
import { dataBR } from "@/modules/email/modelos/tipos";
import { compraDaReferencia, processarPagamentoCreditos } from "@/modules/ia/compraCreditos";
import { aoEstornoDoIndicado, aoPagamentoAprovadoDoIndicado, aplicarPendentesDoTeste } from "@/modules/indicacao/fluxo";
import { restaurarPrecoDepoisDoDesconto } from "@/modules/indicacao/recompensa";
import { enviarEventoMeta } from "@/modules/marketing/metaCapi";
import {
  MercadoPagoService,
  centavosParaReais,
  type MercadoPagoPreapproval,
  type PagamentoMercadoPago,
} from "@/services/mercadoPagoService";
import { fimDoPeriodo } from "./periodo";
import { linksPesquisaCancelamento } from "./pesquisa";

const NOME_PLANO: Record<string, string> = { MONTHLY: "Mensal", ANNUAL: "Anual" };

export async function registrarPagamentoPlataforma(
  pagamento: PagamentoMercadoPago,
  contaId: string,
  tipo: "ASSINATURA" | "CREDITO_IA"
): Promise<void> {
  const bruto = {
    id: pagamento.id,
    status: pagamento.status,
    status_detail: pagamento.status_detail ?? null,
    external_reference: pagamento.external_reference,
    transaction_amount: pagamento.transaction_amount ?? null,
    payment_method_id: pagamento.payment_method_id ?? null,
    payment_type_id: pagamento.payment_type_id ?? null,
    date_created: pagamento.date_created ?? null,
    date_approved: pagamento.date_approved ?? null,
  };
  const dados = {
    contaId,
    tipo,
    valorCentavos: Math.round((pagamento.transaction_amount ?? 0) * 100),
    status: pagamento.status,
    metodo: pagamento.payment_type_id ?? pagamento.payment_method_id ?? null,
    aprovadoEm: pagamento.date_approved ? new Date(pagamento.date_approved) : null,
    referencia: pagamento.external_reference,
    compraId: compraDaReferencia(pagamento.external_reference),
    emailPagador: pagamento.payer?.email?.toLowerCase() ?? null,
    bruto: bruto as Prisma.InputJsonValue,
  };
  await prisma.pagamentoPlataforma.upsert({
    where: { mpPaymentId: String(pagamento.id) },
    update: dados,
    create: { mpPaymentId: String(pagamento.id), ...dados },
  });
}

async function dono(contaId: string) {
  return prisma.user.findUnique({ where: { id: contaId }, select: { id: true, name: true, email: true } });
}

export async function tratarPreapproval(preapproval: MercadoPagoPreapproval, agora: Date = new Date()): Promise<string> {
  const assinatura = await prisma.subscription.findUnique({ where: { mpPreapprovalId: preapproval.id } });
  if (!assinatura) {
    const legadoIa = await prisma.subscription.findUnique({ where: { mpPreapprovalIaId: preapproval.id }, select: { id: true } });
    return legadoIa || preapproval.external_reference?.startsWith("ia:") ? "IGNORADO_ADDON_LEGADO" : "SEM_ASSINATURA";
  }

  if (preapproval.status === "authorized") {
    if (assinatura.pausadaAte) return "PAUSA_EM_ANDAMENTO";
    const inicioCobranca = preapproval.auto_recurring.start_date ? new Date(preapproval.auto_recurring.start_date) : null;
    const inicio = inicioCobranca && inicioCobranca.getTime() > agora.getTime() ? inicioCobranca : agora;
    const primeiraVez = assinatura.status !== "ACTIVE";
    await prisma.subscription.update({
      where: { id: assinatura.id },
      data: {
        status: "ACTIVE",
        currentPeriodStart: assinatura.status === "ACTIVE" ? assinatura.currentPeriodStart : inicio,
        currentPeriodEnd: assinatura.status === "ACTIVE" && assinatura.currentPeriodEnd ? assinatura.currentPeriodEnd : fimDoPeriodo(inicio, assinatura.plan),
        proximaCobrancaEm: preapproval.next_payment_date ? new Date(preapproval.next_payment_date) : inicio,
      },
    });
    invalidarSituacaoConta(assinatura.userId);
    if (primeiraVez) {
      await registrarEvento(assinatura.userId, "ASSINOU", { propriedades: { plano: assinatura.plan } });
      await enviarEventoMeta({ nome: "StartTrial", idEvento: `assinou-${assinatura.id}`, userId: assinatura.userId });
    }
    return "ATIVA";
  }

  if (preapproval.status === "cancelled") {
    if (assinatura.status === "CANCELED") return "JA_CANCELADA";
    await prisma.subscription.update({ where: { id: assinatura.id }, data: { status: "CANCELED" } });
    invalidarSituacaoConta(assinatura.userId);
    await aoCancelar(assinatura);
    return "CANCELADA";
  }

  return "SEM_MUDANCA";
}

export async function aoCancelar(assinatura: Pick<Subscription, "id" | "userId" | "currentPeriodEnd">): Promise<void> {
  await registrarEvento(assinatura.userId, "CANCELOU");
  const pessoa = await dono(assinatura.userId);
  if (!pessoa) return;
  await dispararAutomacao({
    chave: "cancelou",
    contaId: assinatura.userId,
    destinatario: { id: pessoa.id, email: pessoa.email },
    chaveIdempotencia: `cancelou:${assinatura.id}:${assinatura.currentPeriodEnd?.toISOString() ?? "sem-periodo"}`,
    variaveis: {
      data_renovacao: assinatura.currentPeriodEnd ? dataBR(assinatura.currentPeriodEnd) : "o fim do período pago",
      pesquisa: linksPesquisaCancelamento(assinatura.userId)
        .map((link) => `- [${link.rotulo}](${link.url})`)
        .join("\n"),
    },
  });
}

export async function tratarPagamentoAssinatura(pagamento: PagamentoMercadoPago, agora: Date = new Date()): Promise<string> {
  const contaId = pagamento.external_reference!;
  const assinatura = await prisma.subscription.findUnique({ where: { userId: contaId } });
  if (!assinatura || !assinatura.mpPreapprovalId) return "SEM_ASSINATURA";
  const mpPaymentId = String(pagamento.id);
  const anterior = await prisma.pagamentoPlataforma.findUnique({ where: { mpPaymentId }, select: { status: true } });
  await registrarPagamentoPlataforma(pagamento, contaId, "ASSINATURA").catch((error) =>
    console.error("[MP_WEBHOOK] Falha ao registrar o pagamento:", error)
  );

  if (pagamento.status === "rejected" || pagamento.status === "cancelled") {
    await prisma.subscription.update({ where: { id: assinatura.id }, data: { status: "PAST_DUE" } });
    invalidarSituacaoConta(contaId);
    await registrarEvento(contaId, "PAGAMENTO_FALHOU", { propriedades: { mpPaymentId } });
    const pessoa = await dono(contaId);
    if (pessoa) {
      await dispararAutomacao({
        chave: "pagamento-falhou",
        contaId,
        destinatario: { id: pessoa.id, email: pessoa.email },
        chaveIdempotencia: `pagamento-falhou:${mpPaymentId}`,
      });
    }
    return "RECUSADO";
  }

  if (pagamento.status === "refunded" || pagamento.status === "charged_back") {
    await aoEstornoDoIndicado(contaId, pagamento.status === "charged_back" ? "Pagamento contestado no cartão durante a carência." : "Pagamento estornado durante a carência.");
    return "ESTORNADO";
  }

  if (pagamento.status !== "approved") return "PENDENTE";

  if (anterior?.status === "approved") return "REPETIDO";
  const billingCyclesCompleted = assinatura.billingCyclesCompleted + 1;

  const aprovadoEm = pagamento.date_approved ? new Date(pagamento.date_approved) : agora;
  const fimAtual = assinatura.currentPeriodEnd?.getTime() ?? 0;
  const inicioPeriodo = fimAtual > aprovadoEm.getTime() && billingCyclesCompleted > 1 ? assinatura.currentPeriodEnd! : aprovadoEm;
  const fimPeriodo = fimDoPeriodo(inicioPeriodo, assinatura.plan);

  await prisma.subscription.update({
    where: { id: assinatura.id },
    data: { status: "ACTIVE", billingCyclesCompleted, currentPeriodStart: inicioPeriodo, currentPeriodEnd: fimPeriodo },
  });
  invalidarSituacaoConta(contaId);

  if (assinatura.descontoAplicadoCentavos) {
    await restaurarPrecoDepoisDoDesconto(assinatura);
  } else if (billingCyclesCompleted === 1 && assinatura.plan) {
    const recorrente =
      assinatura.precoContratadoCentavos ?? precoDoPlano(await obterConfiguracaoComercial(), assinatura.plan).recorrenteCentavos;
    await MercadoPagoService.updatePreapprovalAmount(assinatura.mpPreapprovalId, centavosParaReais(recorrente));
  }

  if (billingCyclesCompleted === 1) {
    await aoPagamentoAprovadoDoIndicado(contaId, mpPaymentId, agora);
    await aplicarPendentesDoTeste(contaId, agora);
    await enviarEventoMeta({
      nome: "Subscribe",
      idEvento: `assinatura-${mpPaymentId}`,
      userId: contaId,
      valorCentavos: Math.round((pagamento.transaction_amount ?? 0) * 100),
    });
  }

  const pessoa = await dono(contaId);
  if (pessoa) {
    await enviarEmailSemFalhar({
      para: pessoa.email,
      modelo: "recibo-assinatura",
      dados: {
        plano: assinatura.plan ? NOME_PLANO[assinatura.plan] : "Skubo",
        valorCentavos: Math.round((pagamento.transaction_amount ?? 0) * 100),
        pagoEm: aprovadoEm,
        proximaCobranca: fimPeriodo,
      },
      chaveIdempotencia: `recibo-assinatura:${mpPaymentId}`,
      userId: pessoa.id,
      contaId,
    });
  }
  return "APROVADO";
}

export async function tratarPagamento(pagamento: PagamentoMercadoPago, agora: Date = new Date()): Promise<string> {
  if (!pagamento.external_reference) return "SEM_REFERENCIA";
  const compraId = compraDaReferencia(pagamento.external_reference);
  if (compraId) {
    const compra = await prisma.compraCreditoIa.findUnique({ where: { id: compraId }, select: { contaId: true } });
    if (!compra) return "COMPRA_DESCONHECIDA";
    await registrarPagamentoPlataforma(pagamento, compra.contaId, "CREDITO_IA").catch((error) =>
      console.error("[MP_WEBHOOK] Falha ao registrar o pagamento:", error)
    );
    return processarPagamentoCreditos(pagamento, agora);
  }
  if (pagamento.external_reference.startsWith("ia:")) return "IGNORADO_ADDON_LEGADO";
  return tratarPagamentoAssinatura(pagamento, agora);
}
