import type { UserRole } from "@prisma/client";
import type { z } from "zod";
import type { AcaoPermissao } from "@/lib/permissoes";
import { formatarDataHoraBrasilia } from "@/modules/financeiro/dominio/periodo";

export interface ContextoFerramenta {
  contaId: string;
  userId: string;
  papel: UserRole;
  podeVerCusto: boolean;
  agora: Date;
}

export interface DefinicaoFerramenta<Entrada = unknown> {
  nome: string;
  rotulo: string;
  descricao: string;
  esquema: z.ZodType<Entrada, z.ZodTypeDef, unknown>;
  permissao: AcaoPermissao | null;
  executar(contexto: ContextoFerramenta, entrada: Entrada): Promise<unknown>;
}

export function definirFerramenta<Entrada>(definicao: DefinicaoFerramenta<Entrada>): DefinicaoFerramenta<unknown> {
  return definicao as unknown as DefinicaoFerramenta<unknown>;
}

export class ErroFerramenta extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErroFerramenta";
  }
}

export function reais(centavos: number | null | undefined): number | null {
  if (centavos === null || centavos === undefined || !Number.isFinite(centavos)) return null;
  return Math.round(centavos) / 100;
}

export function reaisOuZero(centavos: number | null | undefined): number {
  return reais(centavos) ?? 0;
}

export function percentual(fracao: number | null | undefined): number | null {
  if (fracao === null || fracao === undefined || !Number.isFinite(fracao)) return null;
  return Math.round(fracao * 1000) / 10;
}

export function dataSp(data: Date | string | null | undefined): string | null {
  if (!data) return null;
  return formatarDataHoraBrasilia(typeof data === "string" ? new Date(data) : data).slice(0, 10);
}
