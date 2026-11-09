import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const EVENTOS_PRODUTO = [
  "CONTA_CRIADA",
  "EMAIL_VERIFICADO",
  "ML_CONECTADO",
  "BLING_CONECTADO",
  "PRIMEIRA_SINCRONIZACAO",
  "PRIMEIRA_REPOSICAO_VISTA",
  "PRIMEIRA_PERGUNTA_IA",
  "CONVITE_ENVIADO",
  "ASSINOU",
  "PAGAMENTO_FALHOU",
  "CANCELOU",
  "COMPROU_CREDITOS",
  "INDICOU",
  "TESTE_TERMINOU",
] as const;

export type NomeEventoProduto = (typeof EVENTOS_PRODUTO)[number];

const UNICOS: ReadonlySet<NomeEventoProduto> = new Set([
  "CONTA_CRIADA",
  "EMAIL_VERIFICADO",
  "PRIMEIRA_SINCRONIZACAO",
  "PRIMEIRA_REPOSICAO_VISTA",
  "PRIMEIRA_PERGUNTA_IA",
  "TESTE_TERMINOU",
]);

export async function registrarEvento(
  contaId: string,
  nome: NomeEventoProduto,
  opcoes: { userId?: string | null; propriedades?: Prisma.InputJsonValue } = {}
): Promise<boolean> {
  try {
    if (UNICOS.has(nome)) {
      const existente = await prisma.eventoProduto.findFirst({ where: { contaId, nome }, select: { id: true } });
      if (existente) return false;
    }
    await prisma.eventoProduto.create({
      data: { contaId, nome, userId: opcoes.userId ?? null, propriedades: opcoes.propriedades },
    });
    return true;
  } catch (error) {
    console.error(`[EVENTO_PRODUTO] Falha ao registrar ${nome}:`, error);
    return false;
  }
}

export async function contaTemEvento(contaId: string, nome: NomeEventoProduto): Promise<boolean> {
  const evento = await prisma.eventoProduto.findFirst({ where: { contaId, nome }, select: { id: true } });
  return Boolean(evento);
}
