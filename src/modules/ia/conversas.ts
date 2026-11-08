import { PapelMensagemIa } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { retencaoDias } from "./config";

const DIA_MS = 24 * 60 * 60 * 1000;
export const CONVERSAS_POR_PAGINA = 20;

export interface Autor {
  id: string;
  contaId: string;
}

export async function listarConversas(autor: Autor, pagina: number) {
  const onde = { autorId: autor.id, userId: autor.contaId, arquivadaEm: null };
  const [total, conversas] = await Promise.all([
    prisma.conversaIa.count({ where: onde }),
    prisma.conversaIa.findMany({
      where: onde,
      orderBy: { updatedAt: "desc" },
      skip: (pagina - 1) * CONVERSAS_POR_PAGINA,
      take: CONVERSAS_POR_PAGINA,
      select: { id: true, titulo: true, createdAt: true, updatedAt: true },
    }),
  ]);
  return { conversas, total, pagina, porPagina: CONVERSAS_POR_PAGINA, temMais: pagina * CONVERSAS_POR_PAGINA < total };
}

function nomesDasFerramentas(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .map((f) => (f && typeof f === "object" ? (f as { nome?: unknown }).nome : null))
    .filter((nome): nome is string => typeof nome === "string");
}

export async function obterConversa(autor: Autor, id: string) {
  const conversa = await prisma.conversaIa.findFirst({
    where: { id, autorId: autor.id, userId: autor.contaId, arquivadaEm: null },
    select: {
      id: true,
      titulo: true,
      createdAt: true,
      updatedAt: true,
      mensagens: {
        orderBy: { createdAt: "asc" },
        select: { id: true, papel: true, conteudo: true, util: true, ferramentas: true, createdAt: true },
      },
    },
  });
  if (!conversa) return null;
  return {
    ...conversa,
    mensagens: conversa.mensagens.map((m) => ({ ...m, ferramentas: nomesDasFerramentas(m.ferramentas) })),
  };
}

export async function renomearConversa(autor: Autor, id: string, titulo: string): Promise<boolean> {
  const r = await prisma.conversaIa.updateMany({
    where: { id, autorId: autor.id, userId: autor.contaId },
    data: { titulo: titulo.trim().slice(0, 80) },
  });
  return r.count > 0;
}

export async function apagarConversa(autor: Autor, id: string): Promise<boolean> {
  const r = await prisma.conversaIa.deleteMany({ where: { id, autorId: autor.id, userId: autor.contaId } });
  return r.count > 0;
}

export async function apagarConversasDaConta(contaId: string): Promise<number> {
  const r = await prisma.conversaIa.deleteMany({ where: { userId: contaId } });
  return r.count;
}

export async function registrarFeedback(
  autor: Autor,
  mensagemId: string,
  util: boolean,
  comentario: string | null
): Promise<boolean> {
  const r = await prisma.mensagemIa.updateMany({
    where: {
      id: mensagemId,
      papel: PapelMensagemIa.ASSISTENTE,
      conversa: { autorId: autor.id, userId: autor.contaId },
    },
    data: { util, comentarioFeedback: comentario?.trim() ? comentario.trim().slice(0, 1000) : null },
  });
  return r.count > 0;
}

export async function limparConversasAntigas(agora: Date = new Date()): Promise<number> {
  const limite = new Date(agora.getTime() - retencaoDias() * DIA_MS);
  const r = await prisma.conversaIa.deleteMany({ where: { updatedAt: { lt: limite } } });
  return r.count;
}
