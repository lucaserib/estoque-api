import { PapelMensagemIa } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface FeedbackNegativoIa {
  id: string;
  criadoEm: string;
  conta: string;
  pergunta: string | null;
  resposta: string;
  comentario: string | null;
  ferramentas: string[];
}

export interface PaginaFeedbackIa {
  itens: FeedbackNegativoIa[];
  total: number;
  pagina: number;
  porPagina: number;
}

function nomesDasFerramentas(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .map((f) => (f && typeof f === "object" && typeof (f as { nome?: unknown }).nome === "string" ? (f as { nome: string }).nome : null))
    .filter((nome): nome is string => Boolean(nome));
}

export async function listarFeedbackNegativo(pagina: number, porPagina = 20): Promise<PaginaFeedbackIa> {
  const onde = { util: false, papel: PapelMensagemIa.ASSISTENTE };
  const [total, mensagens] = await Promise.all([
    prisma.mensagemIa.count({ where: onde }),
    prisma.mensagemIa.findMany({
      where: onde,
      orderBy: { createdAt: "desc" },
      skip: (pagina - 1) * porPagina,
      take: porPagina,
      select: {
        id: true,
        conversaId: true,
        conteudo: true,
        comentarioFeedback: true,
        ferramentas: true,
        createdAt: true,
        conversa: { select: { conta: { select: { email: true } } } },
      },
    }),
  ]);

  const perguntas = await Promise.all(
    mensagens.map((m) =>
      prisma.mensagemIa.findFirst({
        where: { conversaId: m.conversaId, papel: PapelMensagemIa.USUARIO, createdAt: { lte: m.createdAt } },
        orderBy: { createdAt: "desc" },
        select: { conteudo: true },
      })
    )
  );

  return {
    itens: mensagens.map((m, i) => ({
      id: m.id,
      criadoEm: m.createdAt.toISOString(),
      conta: m.conversa.conta.email,
      pergunta: perguntas[i]?.conteudo ?? null,
      resposta: m.conteudo,
      comentario: m.comentarioFeedback,
      ferramentas: nomesDasFerramentas(m.ferramentas),
    })),
    total,
    pagina,
    porPagina,
  };
}
