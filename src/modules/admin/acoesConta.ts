import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroAdmin } from "@/helpers/verifyAdminPlataforma";
import { normalizarCodigoCupom } from "@/modules/comercial/cupons";
import { aoCancelar } from "@/modules/cobranca/webhookMercadoPago";
import { criarAssinaturaDaConta, invalidarSituacaoConta } from "@/modules/conta/situacao";
import { concederLote, validadeEmDias } from "@/modules/ia/creditos";
import { aplicarCreditoNaHora } from "@/modules/indicacao/recompensa";
import { MercadoPagoService, isMercadoPagoConfigured } from "@/services/mercadoPagoService";

const DIA_MS = 24 * 60 * 60 * 1000;

export const acaoContaSchema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("estender-teste"), dias: z.number().int().min(1).max(90) }),
  z.object({ acao: z.literal("conceder-dias"), dias: z.number().int().min(1).max(365) }),
  z.object({ acao: z.literal("conceder-creditos"), quantidade: z.number().int().min(1).max(10000), validadeDias: z.number().int().min(1).max(1095).default(365) }),
  z.object({ acao: z.literal("liberar-ia"), liberar: z.boolean() }),
  z.object({ acao: z.literal("aplicar-cupom"), codigo: z.string().trim().min(3).max(40) }),
  z.object({ acao: z.literal("cancelar-assinatura") }),
  z.object({ acao: z.literal("teste-interno"), valor: z.boolean() }),
  z.object({ acao: z.literal("bloquear") }),
  z.object({ acao: z.literal("desbloquear") }),
  z.object({ acao: z.literal("reenviar-email"), emailId: z.string().min(1) }),
  z.object({ acao: z.literal("executar-exclusao"), confirmacaoEmail: z.string().trim().min(3) }),
]);

export type AcaoConta = z.infer<typeof acaoContaSchema>;

interface Contexto {
  motivo: string;
  agora?: Date;
}

export interface RegistroDaAcao {
  acao: string;
  alvoTipo: string;
  alvoId: string;
  antes?: unknown;
  depois?: unknown;
}

export interface ResultadoAcao {
  resultado: Record<string, unknown>;
  auditoria: RegistroDaAcao;
}

async function donoDaConta(contaId: string) {
  const dono = await prisma.user.findFirst({ where: { id: contaId, contaId: null }, include: { subscription: true } });
  if (!dono) throw new ErroAdmin("Conta não encontrada", 404);
  return dono;
}

export async function executarAcaoConta(contaId: string, acao: AcaoConta, contexto: Contexto): Promise<ResultadoAcao> {
  const agora = contexto.agora ?? new Date();
  const dono = await donoDaConta(contaId);
  const nomeAcao = `CONTA_${acao.acao.toUpperCase().replace(/-/g, "_")}`;
  const feito = (resultado: Record<string, unknown>, antes: unknown, depois: unknown): ResultadoAcao => ({
    resultado,
    auditoria: { acao: nomeAcao, alvoTipo: "CONTA", alvoId: contaId, antes, depois },
  });

  switch (acao.acao) {
    case "estender-teste": {
      const assinatura = dono.subscription ?? (await criarAssinaturaDaConta(contaId, agora));
      if (assinatura.status !== "TRIALING") throw new ErroAdmin("A conta não está em teste. Use \"conceder dias de assinatura\".");
      const base = assinatura.trialEndsAt.getTime() > agora.getTime() ? assinatura.trialEndsAt : agora;
      const trialEndsAt = new Date(base.getTime() + acao.dias * DIA_MS);
      await prisma.subscription.update({ where: { id: assinatura.id }, data: { trialEndsAt } });
      invalidarSituacaoConta(contaId);
      return feito({ trialEndsAt }, { trialEndsAt: assinatura.trialEndsAt }, { trialEndsAt });
    }
    case "conceder-dias": {
      const credito = await prisma.creditoDiasAssinatura.create({
        data: { contaId, dias: acao.dias, origem: "ADMIN", descricao: `Concedido pela equipe: ${contexto.motivo}`.slice(0, 300) },
      });
      const forma = await aplicarCreditoNaHora(credito, agora);
      return feito({ forma }, null, { dias: acao.dias, forma, creditoId: credito.id });
    }
    case "conceder-creditos": {
      const { lote } = await concederLote(
        {
          contaId,
          origem: "BONUS_ADMIN",
          quantidade: acao.quantidade,
          validoAte: validadeEmDias(acao.validadeDias, agora),
          chaveIdempotencia: `admin:${randomUUID()}`,
          descricao: `Bônus da equipe Skubo: ${contexto.motivo}`.slice(0, 200),
        },
        agora
      );
      return feito({ loteId: lote.id }, null, { quantidade: acao.quantidade, validoAte: lote.validoAte, loteId: lote.id });
    }
    case "liberar-ia": {
      const assinatura = dono.subscription ?? (await criarAssinaturaDaConta(contaId, agora));
      await prisma.subscription.update({
        where: { id: assinatura.id },
        data: { iaLiberadaManual: acao.liberar, ...(acao.liberar ? { iaAtivadaEm: agora } : {}) },
      });
      return feito({ iaLiberadaManual: acao.liberar }, { iaLiberadaManual: assinatura.iaLiberadaManual }, { iaLiberadaManual: acao.liberar });
    }
    case "aplicar-cupom": {
      const cupom = await prisma.cupom.findUnique({ where: { codigo: normalizarCodigoCupom(acao.codigo) } });
      if (!cupom || !cupom.ativo) throw new ErroAdmin("Cupom não encontrado ou inativo.");
      if (cupom.alvo === "PACOTE_IA") throw new ErroAdmin("Cupom de pacote de IA é usado pela própria loja na compra.");
      const assinatura = dono.subscription ?? (await criarAssinaturaDaConta(contaId, agora));
      if (assinatura.status === "ACTIVE") throw new ErroAdmin("A conta já tem assinatura ativa: o cupom vale só para a primeira cobrança.");
      await prisma.subscription.update({ where: { id: assinatura.id }, data: { cupomPrimeiraCobrancaId: cupom.id } });
      return feito({ cupom: cupom.codigo }, { cupomPrimeiraCobrancaId: assinatura.cupomPrimeiraCobrancaId }, { cupom: cupom.codigo });
    }
    case "cancelar-assinatura": {
      const assinatura = dono.subscription;
      if (!assinatura?.mpPreapprovalId || assinatura.status === "CANCELED") throw new ErroAdmin("Não há assinatura ativa no Mercado Pago.");
      if (!isMercadoPagoConfigured()) throw new ErroAdmin("Mercado Pago não configurado.", 503);
      await MercadoPagoService.cancelPreapproval(assinatura.mpPreapprovalId);
      await prisma.subscription.update({ where: { id: assinatura.id }, data: { status: "CANCELED" } });
      invalidarSituacaoConta(contaId);
      await aoCancelar(assinatura);
      return feito({ status: "CANCELED" }, { status: assinatura.status }, { status: "CANCELED" });
    }
    case "teste-interno": {
      const perfil = await prisma.perfilCliente.findUnique({ where: { contaId } });
      if (!perfil) throw new ErroAdmin("Conta sem perfil de cliente.");
      await prisma.perfilCliente.update({ where: { contaId }, data: { testeInterno: acao.valor } });
      return feito({ testeInterno: acao.valor }, { testeInterno: perfil.testeInterno }, { testeInterno: acao.valor });
    }
    case "bloquear": {
      await prisma.user.update({
        where: { id: contaId },
        data: { bloqueadoEm: agora, motivoBloqueio: contexto.motivo.slice(0, 300), sessaoValidaDesde: agora },
      });
      invalidarSituacaoConta(contaId);
      return feito({ bloqueada: true }, { bloqueadoEm: dono.bloqueadoEm }, { bloqueadoEm: agora });
    }
    case "desbloquear": {
      await prisma.user.update({ where: { id: contaId }, data: { bloqueadoEm: null, motivoBloqueio: null } });
      invalidarSituacaoConta(contaId);
      return feito({ bloqueada: false }, { bloqueadoEm: dono.bloqueadoEm }, { bloqueadoEm: null });
    }
    case "reenviar-email": {
      const original = await prisma.emailEnviado.findUnique({ where: { id: acao.emailId } });
      if (!original || (original.contaId !== contaId && original.userId !== contaId)) throw new ErroAdmin("E-mail não encontrado", 404);
      if (original.dados === null) {
        throw new ErroAdmin("Este e-mail não guarda o conteúdo (tinha link de uso único). Use \"enviar redefinição de senha\" ou \"reenviar confirmação\" em Usuários.");
      }
      const copia = await prisma.emailEnviado.create({
        data: {
          para: original.para,
          modelo: original.modelo,
          categoria: original.categoria,
          contaId: original.contaId,
          userId: original.userId,
          campanhaId: original.campanhaId,
          dados: original.dados,
          chaveIdempotencia: `${original.chaveIdempotencia}:reenvio:${agora.getTime()}`,
        },
      });
      return feito({ reenvioId: copia.id }, null, { emailOriginal: original.id, reenvio: copia.id });
    }
    case "executar-exclusao": {
      if (acao.confirmacaoEmail.toLowerCase() !== dono.email.toLowerCase()) {
        throw new ErroAdmin("Digite o e-mail do dono da conta exatamente para confirmar a exclusão.");
      }
      await excluirConta(contaId, agora);
      return { resultado: { excluida: true }, auditoria: { acao: "CONTA_EXCLUIDA_LGPD", alvoTipo: "CONTA", alvoId: contaId } };
    }
  }
}

export async function excluirConta(contaId: string, agora: Date = new Date()): Promise<void> {
  const membros = await prisma.user.findMany({ where: { contaId }, select: { id: true } });
  const emails = await prisma.user.findMany({ where: { OR: [{ id: contaId }, { contaId }] }, select: { email: true } });
  await prisma.$transaction([
    prisma.movimentoCreditoIa.deleteMany({ where: { contaId } }),
    prisma.loteCreditoIa.deleteMany({ where: { contaId } }),
    prisma.compraCreditoIa.deleteMany({ where: { contaId } }),
    prisma.creditoDiasAssinatura.deleteMany({ where: { contaId } }),
    prisma.indicacao.deleteMany({ where: { OR: [{ indicadoContaId: contaId }, { indicadorContaId: contaId }] } }),
    prisma.emailEnviado.deleteMany({
      where: { OR: [{ contaId }, { userId: contaId }, { para: { in: emails.map((e) => e.email.toLowerCase()) } }] },
    }),
    prisma.auditoriaConta.deleteMany({ where: { contaId } }),
    prisma.motivoCancelamento.deleteMany({ where: { contaId } }),
    prisma.usoCupom.deleteMany({ where: { contaId } }),
    prisma.user.updateMany({ where: { contaId }, data: { contaId: null, role: "ADMIN", sessaoValidaDesde: agora } }),
    prisma.user.delete({ where: { id: contaId } }),
    prisma.solicitacaoExclusao.updateMany({
      where: { contaId, status: "PENDENTE" },
      data: { status: "EXECUTADA", executadaEm: agora },
    }),
  ]);
  for (const membro of membros) {
    await criarAssinaturaDaConta(membro.id, agora).catch(() => undefined);
  }
  invalidarSituacaoConta(contaId);
}
