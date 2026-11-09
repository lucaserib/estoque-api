import { z } from "zod";
import type { CategoriaEmail, TipoConsentimento } from "@prisma/client";
import { prisma, type ClienteTransacao } from "@/lib/prisma";

export const VERSOES_TEXTOS: Record<TipoConsentimento, string> = {
  TERMOS: "2026-11-08",
  PRIVACIDADE: "2026-11-08",
  MARKETING_EMAIL: "2026-11-08",
  MARKETING_WHATSAPP: "2026-11-08",
  CICLO_DE_VIDA: "2026-11-08",
};

export const preferenciasSchema = z.object({
  marketingEmail: z.boolean().default(false),
  marketingWhatsapp: z.boolean().default(false),
  cicloDeVida: z.boolean().default(true),
  termosVersao: z.string().nullable().default(null),
  privacidadeVersao: z.string().nullable().default(null),
});

export type PreferenciasUsuario = z.infer<typeof preferenciasSchema>;

export function lerPreferencias(valor: unknown): PreferenciasUsuario {
  const lido = preferenciasSchema.safeParse(valor ?? {});
  return lido.success ? lido.data : preferenciasSchema.parse({});
}

export function podeReceberCategoria(preferencias: PreferenciasUsuario, categoria: CategoriaEmail): boolean {
  if (categoria === "TRANSACIONAL") return true;
  if (categoria === "CICLO_DE_VIDA") return preferencias.cicloDeVida;
  return preferencias.marketingEmail;
}

export function aplicarAoEstado(
  preferencias: PreferenciasUsuario,
  tipo: TipoConsentimento,
  concedido: boolean,
  versao: string
): PreferenciasUsuario {
  switch (tipo) {
    case "MARKETING_EMAIL":
      return { ...preferencias, marketingEmail: concedido };
    case "MARKETING_WHATSAPP":
      return { ...preferencias, marketingWhatsapp: concedido };
    case "CICLO_DE_VIDA":
      return { ...preferencias, cicloDeVida: concedido };
    case "TERMOS":
      return { ...preferencias, termosVersao: concedido ? versao : null };
    case "PRIVACIDADE":
      return { ...preferencias, privacidadeVersao: concedido ? versao : null };
  }
}

export interface ContextoConsentimento {
  origem: "cadastro" | "boas-vindas" | "perfil" | "descadastro" | "admin";
  ip?: string | null;
  userAgent?: string | null;
}

export async function registrarConsentimentos(
  userId: string,
  itens: Array<{ tipo: TipoConsentimento; concedido: boolean }>,
  contexto: ContextoConsentimento,
  cliente: ClienteTransacao = prisma
): Promise<PreferenciasUsuario> {
  const usuario = await cliente.user.findUnique({ where: { id: userId }, select: { preferencias: true } });
  let preferencias = lerPreferencias(usuario?.preferencias);

  for (const item of itens) {
    preferencias = aplicarAoEstado(preferencias, item.tipo, item.concedido, VERSOES_TEXTOS[item.tipo]);
  }

  await cliente.consentimentoRegistro.createMany({
    data: itens.map((item) => ({
      userId,
      tipo: item.tipo,
      concedido: item.concedido,
      versaoTexto: VERSOES_TEXTOS[item.tipo],
      origem: contexto.origem,
      ip: contexto.ip?.slice(0, 80) ?? null,
      userAgent: contexto.userAgent?.slice(0, 300) ?? null,
    })),
  });
  await cliente.user.update({ where: { id: userId }, data: { preferencias } });
  return preferencias;
}

export async function preferenciasDoUsuario(userId: string): Promise<PreferenciasUsuario> {
  const usuario = await prisma.user.findUnique({ where: { id: userId }, select: { preferencias: true } });
  return lerPreferencias(usuario?.preferencias);
}
