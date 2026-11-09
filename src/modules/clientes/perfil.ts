import crypto from "node:crypto";
import { Prisma, type PerfilCliente } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const FAIXAS_PEDIDOS = ["ATE_30", "DE_31_A_200", "DE_201_A_700", "DE_701_A_1500", "MAIS_DE_1500"] as const;
export const ROTULOS_FAIXAS: Record<(typeof FAIXAS_PEDIDOS)[number], string> = {
  ATE_30: "Até 30",
  DE_31_A_200: "31 a 200",
  DE_201_A_700: "201 a 700",
  DE_701_A_1500: "701 a 1.500",
  MAIS_DE_1500: "Mais de 1.500",
};
export const CANAIS_VENDA = ["MERCADO_LIVRE", "SHOPEE", "AMAZON", "LOJA_PROPRIA", "OUTROS"] as const;
export const ROTULOS_CANAIS: Record<(typeof CANAIS_VENDA)[number], string> = {
  MERCADO_LIVRE: "Mercado Livre",
  SHOPEE: "Shopee",
  AMAZON: "Amazon",
  LOJA_PROPRIA: "Loja própria",
  OUTROS: "Outros",
};
export const ORIGENS_CONHECEU = ["INSTAGRAM", "YOUTUBE", "INDICACAO", "GOOGLE", "GRUPO_WHATSAPP", "OUTRO"] as const;
export const ROTULOS_ORIGENS: Record<(typeof ORIGENS_CONHECEU)[number], string> = {
  INSTAGRAM: "Instagram",
  YOUTUBE: "YouTube",
  INDICACAO: "Indicação",
  GOOGLE: "Google",
  GRUPO_WHATSAPP: "Grupo de WhatsApp",
  OUTRO: "Outro",
};

export function gerarCodigoIndicacao(tamanho = 4): string {
  const bytes = crypto.randomBytes(tamanho);
  let codigo = "";
  for (let i = 0; i < tamanho; i++) codigo += ALFABETO[bytes[i] % ALFABETO.length];
  return `SKU-${codigo}`;
}

export function normalizarCodigoIndicacao(codigo: string | null | undefined): string | null {
  const limpo = codigo?.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  if (!limpo) return null;
  return limpo.startsWith("SKU-") ? limpo : `SKU-${limpo.replace(/^SKU/, "")}`;
}

export function normalizarWhatsapp(valor: string | null | undefined): string | null {
  const digitos = valor?.replace(/\D/g, "") ?? "";
  if (!digitos) return null;
  const nacional = digitos.startsWith("55") && digitos.length >= 12 ? digitos.slice(2) : digitos;
  if (nacional.length < 10 || nacional.length > 11) return null;
  return `+55${nacional}`;
}

export interface DadosPerfilCliente {
  nomeLoja?: string | null;
  whatsapp?: string | null;
  faixaPedidosMes?: string | null;
  canais?: string[];
  comoConheceu?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  paginaEntrada?: string | null;
  referrer?: string | null;
  primeiroToqueEm?: Date | null;
  perfilCompleto?: boolean;
}

function limitar(valor: string | null | undefined, tamanho: number): string | null {
  const limpo = valor?.trim();
  return limpo ? limpo.slice(0, tamanho) : null;
}

export function camposDoPerfil(dados: DadosPerfilCliente): Prisma.PerfilClienteUncheckedUpdateInput {
  const campos: Prisma.PerfilClienteUncheckedUpdateInput = {};
  if (dados.nomeLoja !== undefined) campos.nomeLoja = limitar(dados.nomeLoja, 120);
  if (dados.whatsapp !== undefined) campos.whatsapp = normalizarWhatsapp(dados.whatsapp);
  if (dados.faixaPedidosMes !== undefined) {
    campos.faixaPedidosMes = FAIXAS_PEDIDOS.includes(dados.faixaPedidosMes as (typeof FAIXAS_PEDIDOS)[number])
      ? dados.faixaPedidosMes
      : null;
  }
  if (dados.canais !== undefined) {
    campos.canais = [...new Set(dados.canais)].filter((c) => CANAIS_VENDA.includes(c as (typeof CANAIS_VENDA)[number]));
  }
  if (dados.comoConheceu !== undefined) {
    campos.comoConheceu = ORIGENS_CONHECEU.includes(dados.comoConheceu as (typeof ORIGENS_CONHECEU)[number])
      ? dados.comoConheceu
      : null;
  }
  for (const chave of ["utmSource", "utmMedium", "utmCampaign", "utmContent", "utmTerm"] as const) {
    if (dados[chave] !== undefined) campos[chave] = limitar(dados[chave], 120);
  }
  if (dados.paginaEntrada !== undefined) campos.paginaEntrada = limitar(dados.paginaEntrada, 300);
  if (dados.referrer !== undefined) campos.referrer = limitar(dados.referrer, 300);
  if (dados.primeiroToqueEm !== undefined) campos.primeiroToqueEm = dados.primeiroToqueEm;
  if (dados.perfilCompleto) campos.perfilCompletoEm = new Date();
  return campos;
}

export async function garantirPerfilCliente(contaId: string, dados: DadosPerfilCliente = {}): Promise<PerfilCliente> {
  const existente = await prisma.perfilCliente.findUnique({ where: { contaId } });
  if (existente) {
    const campos = camposDoPerfil(dados);
    return Object.keys(campos).length ? prisma.perfilCliente.update({ where: { contaId }, data: campos }) : existente;
  }

  for (let tentativa = 0; tentativa < 8; tentativa++) {
    try {
      return await prisma.perfilCliente.create({
        data: {
          ...(camposDoPerfil(dados) as Omit<Prisma.PerfilClienteUncheckedCreateInput, "contaId" | "codigoIndicacao">),
          contaId,
          codigoIndicacao: gerarCodigoIndicacao(tentativa < 5 ? 4 : 6),
        },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      const criadoEnquanto = await prisma.perfilCliente.findUnique({ where: { contaId } });
      if (criadoEnquanto) return criadoEnquanto;
    }
  }
  throw new Error("Não foi possível gerar um código de indicação único.");
}
