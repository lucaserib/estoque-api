import { PapelMensagemIa, RecursoIa } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { type RateLimitResult, checkRateLimit } from "@/lib/rateLimit";

export const JANELA_LIMITE_SEGUNDOS = 600;
export const LIMITE_PERGUNTAS = 20;
export const LIMITE_EXPLICACOES = 30;

function resultado(usados: number, limite: number, agora: number): RateLimitResult {
  return {
    allowed: usados < limite,
    remaining: Math.max(0, limite - usados),
    resetAt: agora + JANELA_LIMITE_SEGUNDOS * 1000,
  };
}

export async function limitarPerguntas(usuarioId: string, agora: number = Date.now()): Promise<RateLimitResult> {
  if (redis) return checkRateLimit("ia-chat", usuarioId, LIMITE_PERGUNTAS, JANELA_LIMITE_SEGUNDOS);
  const usados = await prisma.mensagemIa.count({
    where: {
      papel: PapelMensagemIa.USUARIO,
      createdAt: { gte: new Date(agora - JANELA_LIMITE_SEGUNDOS * 1000) },
      conversa: { autorId: usuarioId },
    },
  });
  return resultado(usados, LIMITE_PERGUNTAS, agora);
}

export async function limitarExplicacoes(usuarioId: string, agora: number = Date.now()): Promise<RateLimitResult> {
  if (redis) return checkRateLimit("ia-explicar", usuarioId, LIMITE_EXPLICACOES, JANELA_LIMITE_SEGUNDOS);
  const usados = await prisma.usoIa.count({
    where: {
      autorId: usuarioId,
      recurso: RecursoIa.EXPLICACAO,
      createdAt: { gte: new Date(agora - JANELA_LIMITE_SEGUNDOS * 1000) },
    },
  });
  return resultado(usados, LIMITE_EXPLICACOES, agora);
}
