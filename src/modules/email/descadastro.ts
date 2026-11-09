import crypto from "node:crypto";
import type { CategoriaEmail, TipoConsentimento } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { obterSegredoAuth } from "@/lib/authSecret";
import {
  preferenciasDoUsuario,
  registrarConsentimentos,
  type ContextoConsentimento,
} from "@/modules/clientes/consentimento";
import { urlDoApp } from "./config";

export type CategoriaDescadastro = "CICLO_DE_VIDA" | "MARKETING" | "TUDO";
const CATEGORIAS: CategoriaDescadastro[] = ["CICLO_DE_VIDA", "MARKETING", "TUDO"];

function segredo(): string {
  return process.env.DESCADASTRO_SEGREDO?.trim() || `descadastro:${obterSegredoAuth() ?? "dev"}`;
}

function assinar(conteudo: string): string {
  return crypto.createHmac("sha256", segredo()).update(conteudo).digest("base64url").slice(0, 32);
}

export function gerarTokenDescadastro(userId: string, categoria: CategoriaDescadastro): string {
  const conteudo = Buffer.from(`${userId}:${categoria}`).toString("base64url");
  return `${conteudo}.${assinar(conteudo)}`;
}

export function lerTokenDescadastro(token: string | null | undefined): { userId: string; categoria: CategoriaDescadastro } | null {
  if (!token) return null;
  const [conteudo, assinatura] = token.split(".");
  if (!conteudo || !assinatura) return null;
  const esperada = Buffer.from(assinar(conteudo));
  const recebida = Buffer.from(assinatura);
  if (esperada.length !== recebida.length || !crypto.timingSafeEqual(esperada, recebida)) return null;
  const [userId, categoria] = Buffer.from(conteudo, "base64url").toString("utf8").split(":");
  if (!userId || !CATEGORIAS.includes(categoria as CategoriaDescadastro)) return null;
  return { userId, categoria: categoria as CategoriaDescadastro };
}

export function categoriaDescadastroDe(categoria: CategoriaEmail): CategoriaDescadastro | null {
  if (categoria === "CICLO_DE_VIDA") return "CICLO_DE_VIDA";
  if (categoria === "MARKETING") return "MARKETING";
  return null;
}

export function linksDescadastro(userId: string, categoria: CategoriaDescadastro): { pagina: string; umClique: string } {
  const token = encodeURIComponent(gerarTokenDescadastro(userId, categoria));
  return {
    pagina: `${urlDoApp()}/descadastro?t=${token}`,
    umClique: `${urlDoApp()}/api/descadastro?t=${token}`,
  };
}

export function tiposDaCategoria(categoria: CategoriaDescadastro): TipoConsentimento[] {
  if (categoria === "CICLO_DE_VIDA") return ["CICLO_DE_VIDA"];
  if (categoria === "MARKETING") return ["MARKETING_EMAIL"];
  return ["CICLO_DE_VIDA", "MARKETING_EMAIL"];
}

export async function aplicarDescadastro(
  userId: string,
  escolhas: Partial<Record<"cicloDeVida" | "marketing", boolean>>,
  contexto: ContextoConsentimento
): Promise<{ cicloDeVida: boolean; marketing: boolean }> {
  const usuario = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
  if (!usuario) throw new Error("Usuário não encontrado");

  const itens: Array<{ tipo: TipoConsentimento; concedido: boolean }> = [];
  if (escolhas.cicloDeVida !== undefined) itens.push({ tipo: "CICLO_DE_VIDA", concedido: escolhas.cicloDeVida });
  if (escolhas.marketing !== undefined) itens.push({ tipo: "MARKETING_EMAIL", concedido: escolhas.marketing });
  const preferencias = itens.length
    ? await registrarConsentimentos(userId, itens, contexto)
    : await preferenciasDoUsuario(userId);

  const email = usuario.email.toLowerCase();
  if (!preferencias.cicloDeVida && !preferencias.marketingEmail) {
    await prisma.supressaoEmail.upsert({
      where: { email },
      update: {},
      create: { email, motivo: "DESCADASTRO_TOTAL", detalhe: `Descadastro (${contexto.origem})` },
    });
  } else {
    await prisma.supressaoEmail.deleteMany({ where: { email, motivo: "DESCADASTRO_TOTAL" } });
  }

  return { cicloDeVida: preferencias.cicloDeVida, marketing: preferencias.marketingEmail };
}

export function escolhasDoToken(categoria: CategoriaDescadastro): Partial<Record<"cicloDeVida" | "marketing", boolean>> {
  if (categoria === "CICLO_DE_VIDA") return { cicloDeVida: false };
  if (categoria === "MARKETING") return { marketing: false };
  return { cicloDeVida: false, marketing: false };
}
