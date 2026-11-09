import { prisma } from "@/lib/prisma";
import { ErroAdmin } from "@/helpers/verifyAdminPlataforma";
import { estornarCompraNoSistema } from "@/modules/ia/compraCreditos";
import { MercadoPagoService, isMercadoPagoConfigured } from "@/services/mercadoPagoService";
import type { ResultadoAcao } from "./acoesConta";

export interface FiltrosPagamentos {
  tipo?: "ASSINATURA" | "CREDITO_IA" | null;
  status?: string | null;
  de?: Date | null;
  ate?: Date | null;
  contaId?: string | null;
}

export async function listarPagamentos(filtros: FiltrosPagamentos = {}, limite = 500) {
  const pagamentos = await prisma.pagamentoPlataforma.findMany({
    where: {
      ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
      ...(filtros.status ? { status: filtros.status } : {}),
      ...(filtros.contaId ? { contaId: filtros.contaId } : {}),
      ...(filtros.de || filtros.ate
        ? { createdAt: { ...(filtros.de ? { gte: filtros.de } : {}), ...(filtros.ate ? { lte: filtros.ate } : {}) } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limite,
    select: {
      id: true,
      mpPaymentId: true,
      contaId: true,
      tipo: true,
      valorCentavos: true,
      status: true,
      metodo: true,
      aprovadoEm: true,
      createdAt: true,
      compraId: true,
      emailPagador: true,
    },
  });
  const donos = await prisma.user.findMany({
    where: { id: { in: [...new Set(pagamentos.map((p) => p.contaId))] } },
    select: { id: true, email: true, perfilCliente: { select: { nomeLoja: true } } },
  });
  const porId = new Map(donos.map((d) => [d.id, d]));
  return pagamentos.map((p) => ({
    ...p,
    emailConta: porId.get(p.contaId)?.email ?? null,
    loja: porId.get(p.contaId)?.perfilCliente?.nomeLoja ?? null,
  }));
}

function celulaCsv(valor: unknown): string {
  const texto = valor === null || valor === undefined ? "" : valor instanceof Date ? valor.toISOString() : String(valor);
  return /[",;\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function paraCsv(cabecalho: string[], linhas: unknown[][]): string {
  return [cabecalho, ...linhas].map((linha) => linha.map(celulaCsv).join(";")).join("\n");
}

export async function assinaturasPorStatus() {
  const assinaturas = await prisma.subscription.findMany({
    select: {
      userId: true,
      status: true,
      plan: true,
      precoContratadoCentavos: true,
      trialEndsAt: true,
      currentPeriodEnd: true,
      proximaCobrancaEm: true,
      descontoAplicadoCentavos: true,
      pausadaAte: true,
      user: { select: { email: true, perfilCliente: { select: { nomeLoja: true, testeInterno: true } } } },
    },
    orderBy: { updatedAt: "desc" },
    take: 1000,
  });
  return assinaturas.map(({ user, ...a }) => ({
    ...a,
    email: user.email,
    loja: user.perfilCliente?.nomeLoja ?? null,
    testeInterno: Boolean(user.perfilCliente?.testeInterno),
  }));
}

export async function estornarPagamentoDeCreditos(pagamentoId: string): Promise<ResultadoAcao> {
  const pagamento = await prisma.pagamentoPlataforma.findUnique({ where: { id: pagamentoId } });
  if (!pagamento) throw new ErroAdmin("Pagamento não encontrado", 404);
  if (pagamento.tipo !== "CREDITO_IA" || !pagamento.compraId) throw new ErroAdmin("Só compras de perguntas da IA podem ser estornadas por aqui.");
  if (pagamento.status !== "approved") throw new ErroAdmin("Só pagamentos aprovados podem ser estornados.");
  if (!isMercadoPagoConfigured()) throw new ErroAdmin("Mercado Pago não configurado.", 503);

  const reembolso = await MercadoPagoService.reembolsarPagamento(pagamento.mpPaymentId, `estorno-admin:${pagamento.id}`);
  const retiradas = await estornarCompraNoSistema(pagamento.compraId, "Estorno pela equipe Skubo");
  await prisma.pagamentoPlataforma.update({ where: { id: pagamento.id }, data: { status: "refunded" } });
  return {
    resultado: { reembolsoId: reembolso.id, perguntasRetiradas: retiradas },
    auditoria: {
      acao: "PAGAMENTO_ESTORNADO",
      alvoTipo: "PAGAMENTO",
      alvoId: pagamento.id,
      antes: { status: pagamento.status },
      depois: { status: "refunded", reembolso: reembolso.id, perguntasRetiradas: retiradas },
    },
  };
}
