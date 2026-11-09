import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface RegistroAuditoriaAdmin {
  adminEmail: string;
  acao: string;
  alvoTipo: string;
  alvoId?: string | null;
  antes?: unknown;
  depois?: unknown;
  motivo?: string | null;
  ip?: string | null;
}

function paraJson(valor: unknown): Prisma.InputJsonValue | undefined {
  if (valor === undefined || valor === null) return undefined;
  return JSON.parse(JSON.stringify(valor)) as Prisma.InputJsonValue;
}

export async function auditar(registro: RegistroAuditoriaAdmin): Promise<void> {
  await prisma.auditoriaAdmin.create({
    data: {
      adminEmail: registro.adminEmail.toLowerCase(),
      acao: registro.acao,
      alvoTipo: registro.alvoTipo,
      alvoId: registro.alvoId ?? null,
      antes: paraJson(registro.antes),
      depois: paraJson(registro.depois),
      motivo: registro.motivo?.trim().slice(0, 1000) || null,
      ip: registro.ip?.slice(0, 80) ?? null,
    },
  });
}

export function ipDoAdmin(cabecalhos: Headers): string | null {
  return cabecalhos.get("x-forwarded-for")?.split(",")[0]?.trim() || cabecalhos.get("x-real-ip") || null;
}

export class MotivoObrigatorioError extends Error {
  constructor() {
    super("Informe o motivo da ação.");
    this.name = "MotivoObrigatorioError";
  }
}

export function exigirMotivo(motivo: unknown): string {
  if (typeof motivo !== "string" || motivo.trim().length < 3) throw new MotivoObrigatorioError();
  return motivo.trim().slice(0, 1000);
}
