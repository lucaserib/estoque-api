import { Prisma, type Indicacao } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { obterConfiguracaoComercial } from "@/modules/comercial/configuracao";
import { normalizarCodigoIndicacao } from "@/modules/clientes/perfil";
import { registrarEvento } from "@/modules/clientes/eventos";
import { invalidarSituacaoConta } from "@/modules/conta/situacao";
import { dispararAutomacao } from "@/modules/email/automacoes";
import { concederLote, validadeEmDias } from "@/modules/ia/creditos";
import { mascararNome } from "./comum";

export const VALIDADE_BONUS_INDICADO_DIAS = 30;

export async function registrarIndicacaoNoCadastro(
  indicadoContaId: string,
  codigoInformado: string,
  agora: Date = new Date()
): Promise<Indicacao | null> {
  try {
    const codigo = normalizarCodigoIndicacao(codigoInformado);
    if (!codigo) return null;
    const configuracao = await obterConfiguracaoComercial();
    if (!configuracao.indicacao.ativo) return null;

    const existente = await prisma.indicacao.findUnique({ where: { indicadoContaId } });
    if (existente) return existente;

    const perfilIndicador = await prisma.perfilCliente.findUnique({ where: { codigoIndicacao: codigo }, select: { contaId: true } });
    if (!perfilIndicador) return null;

    const autoindicacao = perfilIndicador.contaId === indicadoContaId;
    const mlConectado = (await prisma.mercadoLivreAccount.count({ where: { userId: indicadoContaId } })) > 0;
    let indicacao: Indicacao;
    try {
      indicacao = await prisma.indicacao.create({
        data: {
          indicadorContaId: perfilIndicador.contaId,
          indicadoContaId,
          codigo,
          diasRecompensa: configuracao.indicacao.diasRecompensa,
          ...(autoindicacao
            ? { status: "INVALIDADA" as const, motivoInvalidacao: "Autoindicação: a conta usou o próprio código." }
            : mlConectado
              ? { status: "ATIVADO" as const, ativadoEm: agora }
              : {}),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return prisma.indicacao.findUnique({ where: { indicadoContaId } });
      }
      throw error;
    }
    if (autoindicacao) return indicacao;

    const bonus = configuracao.indicacao.bonusIndicado;
    if (bonus.perguntasIa > 0) {
      await concederLote(
        {
          contaId: indicadoContaId,
          origem: "INDICACAO",
          quantidade: bonus.perguntasIa,
          validoAte: validadeEmDias(VALIDADE_BONUS_INDICADO_DIAS, agora),
          chaveIdempotencia: `bonus-indicado:${indicacao.id}`,
          descricao: "Bônus por entrar com um link de indicação",
          indicacaoId: indicacao.id,
        },
        agora
      );
    }
    if (bonus.diasTesteExtra > 0) {
      const assinatura = await prisma.subscription.findUnique({ where: { userId: indicadoContaId } });
      if (assinatura?.status === "TRIALING") {
        await prisma.subscription.update({
          where: { id: assinatura.id },
          data: { trialEndsAt: new Date(assinatura.trialEndsAt.getTime() + bonus.diasTesteExtra * 24 * 60 * 60 * 1000) },
        });
        invalidarSituacaoConta(indicadoContaId);
      }
    }

    await registrarEvento(perfilIndicador.contaId, "INDICOU", { propriedades: { indicacaoId: indicacao.id } });
    const [indicador, indicado] = await Promise.all([
      prisma.user.findUnique({ where: { id: perfilIndicador.contaId }, select: { id: true, name: true, email: true } }),
      prisma.user.findUnique({ where: { id: indicadoContaId }, select: { name: true, email: true } }),
    ]);
    if (indicador) {
      const nomeMascarado = mascararNome(indicado?.name, indicado?.email);
      await prisma.notification
        .create({
          data: {
            userId: indicador.id,
            type: "INDICACAO",
            title: "Alguém entrou pelo seu link",
            body: `${nomeMascarado} criou uma conta. Quando assinar, você ganha ${indicacao.diasRecompensa} dias grátis.`,
            link: "/indique",
          },
        })
        .catch(() => undefined);
      await dispararAutomacao({
        chave: "indicacao-entrou",
        contaId: indicador.id,
        destinatario: { id: indicador.id, email: indicador.email },
        chaveIdempotencia: `indicacao-entrou:${indicacao.id}`,
        variaveis: { indicado: nomeMascarado, dias: indicacao.diasRecompensa },
      });
    }
    return indicacao;
  } catch (error) {
    console.error("[INDICACAO] Falha ao registrar a indicação no cadastro:", error);
    return null;
  }
}
