import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface RegistroAuditoriaConta {
  contaId: string;
  autorId?: string | null;
  acao: string;
  alvoTipo?: string | null;
  alvoId?: string | null;
  detalhe?: Prisma.InputJsonValue | null;
  ip?: string | null;
}

export async function auditarConta(registro: RegistroAuditoriaConta): Promise<void> {
  try {
    await prisma.auditoriaConta.create({
      data: {
        contaId: registro.contaId,
        autorId: registro.autorId ?? null,
        acao: registro.acao,
        alvoTipo: registro.alvoTipo ?? null,
        alvoId: registro.alvoId ?? null,
        detalhe: registro.detalhe ?? undefined,
        ip: registro.ip?.slice(0, 80) ?? null,
      },
    });
  } catch (error) {
    console.error(`[AUDITORIA_CONTA] Falha ao registrar ${registro.acao}:`, error);
  }
}

export function ipDe(cabecalhos: Headers): string | null {
  return cabecalhos.get("x-forwarded-for")?.split(",")[0]?.trim() || cabecalhos.get("x-real-ip") || null;
}
