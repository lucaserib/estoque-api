import type { CompraCreditoIa } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { emailsAdminPlataforma } from "@/lib/adminPlataforma";
import { obterConfiguracaoComercial, pacotesAtivos } from "@/modules/comercial/configuracao";
import { CupomInvalidoError, registrarUsoCupom, validarCupom } from "@/modules/comercial/cupons";
import { registrarEvento } from "@/modules/clientes/eventos";
import { obterSituacaoConta } from "@/modules/conta/situacao";
import { enviarEmailSemFalhar } from "@/modules/email/enviar";
import { urlDoApp } from "@/modules/email/config";
import { enviarEventoMeta } from "@/modules/marketing/metaCapi";
import {
  MercadoPagoService,
  centavosParaReais,
  isMercadoPagoConfigured,
  type PagamentoMercadoPago,
} from "@/services/mercadoPagoService";
import { concederLote, removerRestanteDoLote, saldoCreditos, validadeEmDias } from "./creditos";

export const PREFIXO_REFERENCIA_CREDITOS = "credito-ia:";
const VALIDADE_CHECKOUT_MS = 24 * 60 * 60 * 1000;

export class CompraCreditosError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 402 | 403 | 404 | 503 = 400,
    readonly codigo = "COMPRA_INVALIDA"
  ) {
    super(message);
    this.name = "CompraCreditosError";
  }
}

export function compraDaReferencia(referencia: string | null | undefined): string | null {
  if (!referencia?.startsWith(PREFIXO_REFERENCIA_CREDITOS)) return null;
  return referencia.slice(PREFIXO_REFERENCIA_CREDITOS.length) || null;
}

async function avisarPedidoSemPagamento(email: string): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { email: { in: emailsAdminPlataforma(), mode: "insensitive" } },
    select: { id: true },
  });
  if (admins.length === 0) return;
  await prisma.notification.createMany({
    data: admins.map((admin) => ({
      userId: admin.id,
      type: "SOLICITACAO_PLATAFORMA" as const,
      title: "Pedido de perguntas da IA",
      body: `${email} quis comprar perguntas da Skubo IA, mas os pagamentos não estão configurados.`,
      link: "/admin/contas",
    })),
  });
}

export interface PedidoCompra {
  usuario: { id: string; contaId: string; email: string; emailVerificadoEm: Date | null };
  pacoteId: string;
  cupom?: string | null;
  agora?: Date;
}

export async function criarCompraCreditos(pedido: PedidoCompra): Promise<{ compra: CompraCreditoIa; checkoutUrl: string }> {
  const agora = pedido.agora ?? new Date();
  const { usuario } = pedido;
  if (!usuario.emailVerificadoEm) {
    throw new CompraCreditosError("Confirme seu e-mail antes de comprar perguntas. Use o aviso no topo da tela.", 403, "EMAIL_NAO_VERIFICADO");
  }
  const situacao = await obterSituacaoConta(usuario.contaId, agora);
  if (!situacao.podeUsar) throw new CompraCreditosError("A assinatura da loja não está ativa.", 402, "ASSINATURA_INATIVA");

  const configuracao = await obterConfiguracaoComercial();
  const pacote = pacotesAtivos(configuracao).find((p) => p.id === pedido.pacoteId);
  if (!pacote) throw new CompraCreditosError("Pacote não encontrado.", 404, "PACOTE_INVALIDO");

  if (!isMercadoPagoConfigured()) {
    await avisarPedidoSemPagamento(usuario.email).catch(() => undefined);
    throw new CompraCreditosError(
      "A compra de perguntas ainda não está disponível. Avisamos a equipe Skubo, que vai falar com você.",
      503,
      "PAGAMENTO_NAO_CONFIGURADO"
    );
  }

  let precoCentavos = pacote.precoCentavos;
  let descontoCentavos = 0;
  let cupomId: string | null = null;
  if (pedido.cupom?.trim()) {
    const aplicavel = await validarCupom(pedido.cupom, "PACOTE_IA", usuario.contaId, pacote.precoCentavos, { agora });
    precoCentavos = aplicavel.precoFinalCentavos;
    descontoCentavos = aplicavel.descontoCentavos;
    cupomId = aplicavel.cupom.id;
  }

  const compra = await prisma.compraCreditoIa.create({
    data: {
      contaId: usuario.contaId,
      autorId: usuario.id,
      pacoteId: pacote.id,
      pacoteNome: pacote.nome,
      perguntas: pacote.perguntas,
      precoCentavos,
      descontoCentavos,
      cupomId,
      expiraEm: new Date(agora.getTime() + VALIDADE_CHECKOUT_MS),
    },
  });

  const base = urlDoApp();
  const volta = `${base}/ia?compra=${compra.id}`;
  const preferencia = await MercadoPagoService.criarPreferencia({
    items: [
      { id: pacote.id, title: `Skubo IA · ${pacote.nome}`, quantity: 1, unit_price: centavosParaReais(precoCentavos), currency_id: "BRL" },
    ],
    external_reference: `${PREFIXO_REFERENCIA_CREDITOS}${compra.id}`,
    notification_url: `${base}/api/mercadopago/webhook`,
    back_urls: { success: volta, pending: volta, failure: volta },
    auto_return: "approved",
    payer: { email: usuario.email },
    payment_methods: { excluded_payment_types: [{ id: "ticket" }, { id: "atm" }], installments: 1 },
    expires: true,
    expiration_date_to: compra.expiraEm.toISOString(),
    date_of_expiration: compra.expiraEm.toISOString(),
    statement_descriptor: "SKUBO IA",
    metadata: { compra_id: compra.id, conta_id: usuario.contaId },
  });

  const atualizada = await prisma.compraCreditoIa.update({ where: { id: compra.id }, data: { mpPreferenceId: preferencia.id } });
  if (cupomId) await registrarUsoCupom(cupomId, usuario.contaId, compra.id);
  return { compra: atualizada, checkoutUrl: preferencia.init_point };
}

export type ResultadoPagamentoCreditos = "APROVADA" | "RECUSADA" | "ESTORNADA" | "PENDENTE" | "IGNORADO";

export async function processarPagamentoCreditos(
  pagamento: PagamentoMercadoPago,
  agora: Date = new Date()
): Promise<ResultadoPagamentoCreditos> {
  const compraId = compraDaReferencia(pagamento.external_reference);
  if (!compraId) return "IGNORADO";
  const compra = await prisma.compraCreditoIa.findUnique({ where: { id: compraId } });
  if (!compra) return "IGNORADO";
  const mpPaymentId = String(pagamento.id);
  if (compra.mpPaymentId && compra.mpPaymentId !== mpPaymentId && compra.status === "APROVADA") return "IGNORADO";

  if (pagamento.status === "approved") {
    const { count } = await prisma.compraCreditoIa.updateMany({
      where: { id: compra.id, status: { in: ["PENDENTE", "RECUSADA", "EXPIRADA"] } },
      data: { status: "APROVADA", mpPaymentId, aprovadaEm: pagamento.date_approved ? new Date(pagamento.date_approved) : agora },
    });
    const configuracao = await obterConfiguracaoComercial();
    const { lote, novo } = await concederLote(
      {
        contaId: compra.contaId,
        origem: "COMPRA",
        quantidade: compra.perguntas,
        validoAte: validadeEmDias(configuracao.iaValidadeDiasCompra, agora),
        chaveIdempotencia: `compra:${compra.id}`,
        descricao: `Compra: ${compra.pacoteNome}`,
        autorId: compra.autorId,
        compraId: compra.id,
      },
      agora
    );
    if (count > 0 || novo) await aposCompraAprovada(compra, lote.validoAte, agora);
    return "APROVADA";
  }

  if (pagamento.status === "rejected" || pagamento.status === "cancelled") {
    await prisma.compraCreditoIa.updateMany({
      where: { id: compra.id, status: "PENDENTE" },
      data: { status: "RECUSADA", mpPaymentId },
    });
    return "RECUSADA";
  }

  if (pagamento.status === "refunded" || pagamento.status === "charged_back") {
    await estornarCompraNoSistema(compra.id, pagamento.status === "charged_back" ? "Contestação no cartão" : "Compra estornada");
    return "ESTORNADA";
  }

  return "PENDENTE";
}

async function aposCompraAprovada(compra: CompraCreditoIa, validoAte: Date, agora: Date): Promise<void> {
  const autor = await prisma.user.findUnique({ where: { id: compra.autorId }, select: { id: true, name: true, email: true } });
  const saldo = await saldoCreditos(compra.contaId, agora);
  if (autor) {
    await prisma.notification
      .create({
        data: {
          userId: autor.id,
          type: "CREDITOS_IA",
          title: "Perguntas da Skubo IA liberadas",
          body: `${compra.perguntas} perguntas entraram na conta. Saldo: ${saldo}.`,
          link: "/ia",
        },
      })
      .catch(() => undefined);
    await enviarEmailSemFalhar({
      para: autor.email,
      modelo: "recibo-creditos",
      dados: { pacote: compra.pacoteNome, perguntas: compra.perguntas, valorCentavos: compra.precoCentavos, validoAte, saldo },
      chaveIdempotencia: `recibo-creditos:${compra.id}`,
      userId: autor.id,
      contaId: compra.contaId,
    });
    await enviarEventoMeta({ nome: "Purchase", idEvento: `compra-${compra.id}`, userId: autor.id, valorCentavos: compra.precoCentavos });
  }
  await registrarEvento(compra.contaId, "COMPROU_CREDITOS", {
    userId: compra.autorId,
    propriedades: { pacote: compra.pacoteId, perguntas: compra.perguntas, valorCentavos: compra.precoCentavos },
  });
}

export async function estornarCompraNoSistema(compraId: string, motivo: string): Promise<number> {
  await prisma.compraCreditoIa.updateMany({ where: { id: compraId, status: { not: "ESTORNADA" } }, data: { status: "ESTORNADA" } });
  const lote = await prisma.loteCreditoIa.findUnique({ where: { compraId }, select: { id: true } });
  if (!lote) return 0;
  return removerRestanteDoLote(lote.id, `${motivo}: perguntas restantes retiradas`, `estorno-compra:${compraId}`);
}

export async function expirarComprasPendentes(agora: Date = new Date()): Promise<number> {
  const { count } = await prisma.compraCreditoIa.updateMany({
    where: { status: "PENDENTE", expiraEm: { lt: agora } },
    data: { status: "EXPIRADA" },
  });
  return count;
}

export { CupomInvalidoError };
