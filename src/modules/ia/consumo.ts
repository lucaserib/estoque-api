import type { RecursoIa } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { obterConfiguracaoComercial } from "@/modules/comercial/configuracao";
import { registrarEvento } from "@/modules/clientes/eventos";
import { dispararAutomacao } from "@/modules/email/automacoes";
import { debitarCreditos, type ResultadoDebito } from "./creditos";

export const LIMIAR_SALDO_BAIXO = 3;

function inicioDoDiaEmSaoPaulo(agora: Date): Date {
  const dia = agora.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return new Date(`${dia}T00:00:00-03:00`);
}

export async function explicacoesGratisUsadasHoje(contaId: string, agora: Date = new Date()): Promise<number> {
  return prisma.usoIa.count({
    where: { userId: contaId, recurso: "EXPLICACAO", sucesso: true, createdAt: { gte: inicioDoDiaEmSaoPaulo(agora) } },
  });
}

export async function custoDoRecurso(recurso: RecursoIa, contaId: string, agora: Date = new Date()): Promise<number> {
  const configuracao = await obterConfiguracaoComercial();
  const pesos = configuracao.iaPesoPorRecurso as Record<string, number>;
  const peso = pesos[recurso] ?? 0;
  if (recurso === "EXPLICACAO" && peso === 0) {
    const usadas = await explicacoesGratisUsadasHoje(contaId, agora);
    return usadas >= configuracao.iaExplicacoesGratisPorDia ? 1 : 0;
  }
  return peso;
}

export interface PedidoCobranca {
  contaId: string;
  autorId: string | null;
  recurso: RecursoIa;
  chave: string;
  ilimitada: boolean;
  descricao?: string;
  agora?: Date;
}

export async function cobrarUsoIa(pedido: PedidoCobranca): Promise<ResultadoDebito & { custo: number }> {
  const agora = pedido.agora ?? new Date();
  if (pedido.ilimitada) return { debitado: 0, saldoAntes: 0, saldoApos: 0, repetido: false, custo: 0 };
  const custo = await custoDoRecurso(pedido.recurso, pedido.contaId, agora);
  const resultado = await debitarCreditos(pedido.contaId, custo, pedido.recurso, pedido.chave, {
    autorId: pedido.autorId,
    descricao: pedido.descricao,
    agora,
  });
  if (resultado.debitado > 0 && !resultado.repetido) {
    await avisarSaldoBaixo(pedido.contaId, pedido.autorId, resultado.saldoAntes, resultado.saldoApos);
  }
  return { ...resultado, custo };
}

export async function avisarSaldoBaixo(
  contaId: string,
  autorId: string | null,
  saldoAntes: number,
  saldoApos: number
): Promise<void> {
  const esgotou = saldoAntes > 0 && saldoApos === 0;
  const ficouBaixo = saldoAntes > LIMIAR_SALDO_BAIXO && saldoApos <= LIMIAR_SALDO_BAIXO && saldoApos > 0;
  if (!esgotou && !ficouBaixo) return;

  try {
    const ultimaEntrada = await prisma.loteCreditoIa.findFirst({
      where: { contaId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    const ciclo = ultimaEntrada?.id ?? "inicio";
    const destinatarios = await prisma.user.findMany({
      where: { id: { in: [...new Set([contaId, autorId].filter((id): id is string => Boolean(id)))] } },
      select: { id: true, email: true },
    });

    for (const pessoa of destinatarios) {
      await prisma.notification.create({
        data: {
          userId: pessoa.id,
          type: "CREDITOS_IA",
          title: esgotou ? "Perguntas da Skubo IA acabaram" : `Restam ${saldoApos} perguntas da Skubo IA`,
          body: esgotou ? "Compre um pacote para continuar perguntando." : "Garanta mais perguntas para não ficar sem resposta.",
          link: "/ia",
        },
      });
      const chave = esgotou ? "creditos-esgotados" : "creditos-acabando";
      await dispararAutomacao({
        chave,
        contaId,
        destinatario: { id: pessoa.id, email: pessoa.email },
        chaveIdempotencia: `${chave}:${contaId}:${ciclo}:${pessoa.id}`,
        variaveis: { saldo_ia: saldoApos },
      });
    }
  } catch (error) {
    console.error("[IA_CREDITOS] Falha ao avisar saldo baixo:", error);
  }
}

export async function registrarPrimeiraPergunta(contaId: string, userId: string): Promise<void> {
  await registrarEvento(contaId, "PRIMEIRA_PERGUNTA_IA", { userId });
}
