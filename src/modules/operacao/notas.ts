import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { type ContextoOperacao, exigirEdicao } from "./contexto";
import { type CorOperacao, LIMITES } from "./dominio/esquemas";
import { posicaoEntre, posicaoNoInicio, posicoesRenumeradas } from "./dominio/posicao";
import { naoEncontrada, regraOperacao, semPermissaoOperacao } from "./erros";
import { cor, pessoa, pessoaSelect } from "./serializacao";
import type { NotaDto } from "./tipos";

const notaSelect = {
  id: true,
  tipo: true,
  titulo: true,
  conteudo: true,
  cor: true,
  fixada: true,
  visibilidade: true,
  posicao: true,
  apoios: true,
  autorId: true,
  arquivadaEm: true,
  createdAt: true,
  updatedAt: true,
  autor: { select: pessoaSelect },
  tarefa: { select: { id: true, numero: true, titulo: true } },
} satisfies Prisma.NotaOperacaoSelect;

type NotaBanco = Prisma.NotaOperacaoGetPayload<{ select: typeof notaSelect }>;

function podeMexer(contexto: ContextoOperacao, nota: { autorId: string | null; visibilidade: string }): boolean {
  if (!contexto.podeEditar) return false;
  if (nota.autorId === contexto.userId) return true;
  return nota.visibilidade === "EQUIPE" && contexto.podeAdministrar;
}

function notaDto(contexto: ContextoOperacao, nota: NotaBanco): NotaDto {
  return {
    id: nota.id,
    tipo: nota.tipo,
    titulo: nota.titulo,
    conteudo: nota.conteudo,
    cor: cor(nota.cor),
    fixada: nota.fixada,
    visibilidade: nota.visibilidade,
    posicao: nota.posicao,
    autor: pessoa(nota.autor),
    apoios: nota.apoios.length,
    apoiadaPorMim: nota.apoios.includes(contexto.userId),
    tarefa: nota.tarefa,
    arquivada: nota.arquivadaEm !== null,
    criadaEm: nota.createdAt.toISOString(),
    atualizadaEm: nota.updatedAt.toISOString(),
    podeEditar: podeMexer(contexto, nota),
  };
}

function visiveis(contexto: ContextoOperacao): Prisma.NotaOperacaoWhereInput {
  return { contaId: contexto.contaId, OR: [{ visibilidade: "EQUIPE" }, { autorId: contexto.userId }] };
}

export async function listarNotas(
  contexto: ContextoOperacao,
  filtros: { tipo: "NOTA" | "IDEIA" | "TODAS"; visibilidade: "EQUIPE" | "PRIVADA" | "TODAS"; arquivadas: boolean; busca?: string }
): Promise<NotaDto[]> {
  const condicoes: Prisma.NotaOperacaoWhereInput[] = [visiveis(contexto), { arquivadaEm: filtros.arquivadas ? { not: null } : null }];
  if (filtros.tipo !== "TODAS") condicoes.push({ tipo: filtros.tipo });
  if (filtros.visibilidade === "PRIVADA") condicoes.push({ visibilidade: "PRIVADA", autorId: contexto.userId });
  if (filtros.visibilidade === "EQUIPE") condicoes.push({ visibilidade: "EQUIPE" });
  const busca = filtros.busca?.trim();
  if (busca) {
    condicoes.push({ OR: [{ titulo: { contains: busca, mode: "insensitive" } }, { conteudo: { contains: busca, mode: "insensitive" } }] });
  }
  const notas = await prisma.notaOperacao.findMany({
    where: { AND: condicoes },
    orderBy: [{ fixada: "desc" }, { posicao: "asc" }],
    take: 500,
    select: notaSelect,
  });
  return notas.map((nota) => notaDto(contexto, nota));
}

async function notaVisivel(contexto: ContextoOperacao, id: string): Promise<NotaBanco> {
  const nota = await prisma.notaOperacao.findFirst({ where: { AND: [{ id }, visiveis(contexto)] }, select: notaSelect });
  if (!nota) throw naoEncontrada("Nota");
  return nota;
}

export async function criarNota(
  contexto: ContextoOperacao,
  dados: { tipo: "NOTA" | "IDEIA"; titulo?: string | null; conteudo: string; cor: CorOperacao; fixada: boolean; visibilidade: "EQUIPE" | "PRIVADA" }
): Promise<NotaDto> {
  exigirEdicao(contexto);
  const total = await prisma.notaOperacao.count({ where: { contaId: contexto.contaId, arquivadaEm: null } });
  if (total >= LIMITES.notasPorConta) throw regraOperacao("A loja chegou ao limite de notas ativas. Arquive as antigas.");
  const primeira = await prisma.notaOperacao.aggregate({ where: { contaId: contexto.contaId }, _min: { posicao: true } });
  const nota = await prisma.notaOperacao.create({
    data: {
      contaId: contexto.contaId,
      autorId: contexto.userId,
      tipo: dados.tipo,
      titulo: dados.titulo?.trim() || null,
      conteudo: dados.conteudo,
      cor: dados.cor,
      fixada: dados.fixada,
      visibilidade: dados.visibilidade,
      posicao: posicaoNoInicio(primeira._min.posicao),
    },
    select: notaSelect,
  });
  return notaDto(contexto, nota);
}

export async function atualizarNota(
  contexto: ContextoOperacao,
  id: string,
  dados: Partial<{
    tipo: "NOTA" | "IDEIA";
    titulo: string | null;
    conteudo: string;
    cor: CorOperacao;
    fixada: boolean;
    visibilidade: "EQUIPE" | "PRIVADA";
    arquivada: boolean;
  }>
): Promise<NotaDto> {
  exigirEdicao(contexto);
  const nota = await notaVisivel(contexto, id);
  if (!podeMexer(contexto, nota)) throw semPermissaoOperacao("Só quem escreveu (ou o administrador, em notas da equipe) pode mudar esta nota.");
  if (dados.visibilidade && dados.visibilidade !== nota.visibilidade && nota.autorId !== contexto.userId) {
    throw semPermissaoOperacao("Só quem escreveu pode mudar quem vê a nota.");
  }
  const atualizada = await prisma.notaOperacao.update({
    where: { id },
    data: {
      ...(dados.tipo !== undefined ? { tipo: dados.tipo } : {}),
      ...(dados.titulo !== undefined ? { titulo: dados.titulo?.trim() || null } : {}),
      ...(dados.conteudo !== undefined ? { conteudo: dados.conteudo } : {}),
      ...(dados.cor !== undefined ? { cor: dados.cor } : {}),
      ...(dados.fixada !== undefined ? { fixada: dados.fixada } : {}),
      ...(dados.visibilidade !== undefined ? { visibilidade: dados.visibilidade } : {}),
      ...(dados.visibilidade === "PRIVADA" ? { apoios: [] } : {}),
      ...(dados.arquivada !== undefined ? { arquivadaEm: dados.arquivada ? nota.arquivadaEm ?? new Date() : null } : {}),
    },
    select: notaSelect,
  });
  return notaDto(contexto, atualizada);
}

export async function apagarNota(contexto: ContextoOperacao, id: string): Promise<void> {
  exigirEdicao(contexto);
  const nota = await notaVisivel(contexto, id);
  if (!podeMexer(contexto, nota)) throw semPermissaoOperacao("Só quem escreveu (ou o administrador, em notas da equipe) pode apagar esta nota.");
  await prisma.notaOperacao.delete({ where: { id } });
}

export async function apoiarNota(contexto: ContextoOperacao, id: string): Promise<NotaDto> {
  exigirEdicao(contexto);
  const linhas = await prisma.$executeRaw`
    UPDATE "notas_operacao"
    SET "apoios" = CASE WHEN ${contexto.userId} = ANY("apoios") THEN array_remove("apoios", ${contexto.userId}) ELSE array_append("apoios", ${contexto.userId}) END,
        "updatedAt" = NOW()
    WHERE "id" = ${id} AND "contaId" = ${contexto.contaId} AND "visibilidade" = 'EQUIPE' AND "arquivadaEm" IS NULL`;
  if (linhas === 0) throw naoEncontrada("Nota");
  return notaDto(contexto, await notaVisivel(contexto, id));
}

export async function moverNota(
  contexto: ContextoOperacao,
  id: string,
  destino: { anteriorId?: string | null; seguinteId?: string | null }
): Promise<NotaDto> {
  exigirEdicao(contexto);
  await notaVisivel(contexto, id);
  const vizinhosIds = [destino.anteriorId, destino.seguinteId].filter((v): v is string => Boolean(v) && v !== id);
  const vizinhos = vizinhosIds.length
    ? await prisma.notaOperacao.findMany({ where: { AND: [{ id: { in: vizinhosIds } }, visiveis(contexto)] }, select: { id: true, posicao: true } })
    : [];
  const antes = vizinhos.find((v) => v.id === destino.anteriorId)?.posicao ?? null;
  const depois = vizinhos.find((v) => v.id === destino.seguinteId)?.posicao ?? null;
  let posicao = antes === null && depois === null ? null : posicaoEntre(antes, depois);
  await prisma.$transaction(async (tx) => {
    if (posicao === null && (antes !== null || depois !== null)) {
      const ordem = await tx.notaOperacao.findMany({
        where: { contaId: contexto.contaId, NOT: { id } },
        orderBy: { posicao: "asc" },
        select: { id: true },
      });
      const novas = posicoesRenumeradas(ordem.length);
      for (const [indice, item] of ordem.entries()) await tx.notaOperacao.update({ where: { id: item.id }, data: { posicao: novas[indice] } });
      const indiceAnterior = ordem.findIndex((item) => item.id === destino.anteriorId);
      posicao = indiceAnterior >= 0 ? novas[indiceAnterior] + 512 : 512;
    }
    if (posicao !== null) await tx.notaOperacao.update({ where: { id }, data: { posicao } });
  });
  return notaDto(contexto, await notaVisivel(contexto, id));
}
