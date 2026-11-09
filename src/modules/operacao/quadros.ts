import type { PapelColunaTarefa, Prisma } from "@prisma/client";
import { prisma, type ClienteTransacao } from "@/lib/prisma";
import { type ContextoOperacao, exigirAdministracao, garantirEstruturaPadrao } from "./contexto";
import { COLUNAS_PADRAO, LIMITES, type CorOperacao } from "./dominio/esquemas";
import { ESPACO_POSICAO, posicaoEntre, posicaoNoFim, posicoesRenumeradas } from "./dominio/posicao";
import { naoEncontrada, regraOperacao } from "./erros";
import { etiquetaDto, quadroDto } from "./serializacao";
import type { ColunaDto, EtiquetaDto, QuadroDto } from "./tipos";

const quadroSelect = {
  id: true,
  nome: true,
  descricao: true,
  cor: true,
  padrao: true,
  arquivadoEm: true,
  colunas: { select: { id: true, nome: true, papel: true, posicao: true, limite: true } },
} satisfies Prisma.QuadroTarefasSelect;

export async function listarQuadros(contexto: ContextoOperacao, incluirArquivados = false): Promise<QuadroDto[]> {
  await garantirEstruturaPadrao(contexto.contaId, contexto.userId);
  const quadros = await prisma.quadroTarefas.findMany({
    where: { contaId: contexto.contaId, ...(incluirArquivados ? {} : { arquivadoEm: null }) },
    orderBy: [{ arquivadoEm: { sort: "asc", nulls: "first" } }, { padrao: "desc" }, { posicao: "asc" }],
    select: quadroSelect,
  });
  return quadros.map(quadroDto);
}

async function quadroDaConta(contexto: ContextoOperacao, id: string) {
  const quadro = await prisma.quadroTarefas.findFirst({ where: { id, contaId: contexto.contaId }, select: quadroSelect });
  if (!quadro) throw naoEncontrada("Quadro");
  return quadro;
}

export async function obterQuadro(contexto: ContextoOperacao, id: string): Promise<QuadroDto> {
  return quadroDto(await quadroDaConta(contexto, id));
}

export async function criarQuadro(
  contexto: ContextoOperacao,
  dados: { nome: string; descricao?: string | null; cor: CorOperacao }
): Promise<QuadroDto> {
  exigirAdministracao(contexto);
  const total = await prisma.quadroTarefas.count({ where: { contaId: contexto.contaId, arquivadoEm: null } });
  if (total >= LIMITES.quadrosPorConta) throw regraOperacao(`A loja pode ter até ${LIMITES.quadrosPorConta} quadros ativos.`);
  const ultima = await prisma.quadroTarefas.aggregate({ where: { contaId: contexto.contaId }, _max: { posicao: true } });
  const quadro = await prisma.quadroTarefas.create({
    data: {
      contaId: contexto.contaId,
      nome: dados.nome,
      descricao: dados.descricao?.trim() || null,
      cor: dados.cor,
      posicao: posicaoNoFim(ultima._max.posicao),
      criadoPorId: contexto.userId,
      colunas: {
        create: COLUNAS_PADRAO.filter((c) => c.nome !== "Aguardando").map((coluna, indice) => ({
          nome: coluna.nome,
          papel: coluna.papel,
          posicao: (indice + 1) * ESPACO_POSICAO,
        })),
      },
    },
    select: quadroSelect,
  });
  return quadroDto(quadro);
}

export async function atualizarQuadro(
  contexto: ContextoOperacao,
  id: string,
  dados: { nome?: string; descricao?: string | null; cor?: CorOperacao; arquivado?: boolean }
): Promise<QuadroDto> {
  exigirAdministracao(contexto);
  const quadro = await quadroDaConta(contexto, id);
  if (dados.arquivado === true && !quadro.arquivadoEm) {
    const ativos = await prisma.quadroTarefas.count({ where: { contaId: contexto.contaId, arquivadoEm: null } });
    if (ativos <= 1) throw regraOperacao("A loja precisa de pelo menos um quadro ativo.");
  }
  const atualizado = await prisma.$transaction(async (tx) => {
    const resultado = await tx.quadroTarefas.update({
      where: { id },
      data: {
        ...(dados.nome !== undefined ? { nome: dados.nome } : {}),
        ...(dados.descricao !== undefined ? { descricao: dados.descricao?.trim() || null } : {}),
        ...(dados.cor !== undefined ? { cor: dados.cor } : {}),
        ...(dados.arquivado !== undefined ? { arquivadoEm: dados.arquivado ? quadro.arquivadoEm ?? new Date() : null } : {}),
        ...(dados.arquivado === true && quadro.padrao ? { padrao: false } : {}),
      },
      select: quadroSelect,
    });
    if (dados.arquivado === true && quadro.padrao) {
      const proximo = await tx.quadroTarefas.findFirst({
        where: { contaId: contexto.contaId, arquivadoEm: null, NOT: { id } },
        orderBy: { posicao: "asc" },
        select: { id: true },
      });
      if (proximo) await tx.quadroTarefas.update({ where: { id: proximo.id }, data: { padrao: true } });
    }
    return resultado;
  });
  return quadroDto(atualizado);
}

function validarPapeis(papeis: PapelColunaTarefa[]): void {
  if (!papeis.includes("A_FAZER")) throw regraOperacao("O quadro precisa de pelo menos uma coluna de “a fazer”.");
  if (!papeis.includes("CONCLUIDA")) throw regraOperacao("O quadro precisa de pelo menos uma coluna de concluídas.");
}

async function colunaDaConta(contexto: ContextoOperacao, id: string) {
  const coluna = await prisma.colunaTarefas.findFirst({
    where: { id, quadro: { contaId: contexto.contaId } },
    select: { id: true, nome: true, papel: true, posicao: true, limite: true, quadroId: true },
  });
  if (!coluna) throw naoEncontrada("Coluna");
  return coluna;
}

async function sincronizarConclusaoDaColuna(
  tx: ClienteTransacao,
  colunaId: string,
  papel: PapelColunaTarefa,
  userId: string
): Promise<void> {
  if (papel === "CONCLUIDA") {
    await tx.tarefa.updateMany({ where: { colunaId, concluidaEm: null }, data: { concluidaEm: new Date(), concluidaPorId: userId } });
  } else {
    await tx.tarefa.updateMany({ where: { colunaId, concluidaEm: { not: null } }, data: { concluidaEm: null, concluidaPorId: null } });
  }
}

export async function criarColuna(
  contexto: ContextoOperacao,
  quadroId: string,
  dados: { nome: string; papel: PapelColunaTarefa; limite?: number | null }
): Promise<ColunaDto> {
  exigirAdministracao(contexto);
  const quadro = await quadroDaConta(contexto, quadroId);
  if (quadro.colunas.length >= LIMITES.colunasPorQuadro) throw regraOperacao(`Um quadro pode ter até ${LIMITES.colunasPorQuadro} colunas.`);
  const concluidas = quadro.colunas.filter((c) => c.papel === "CONCLUIDA").sort((a, b) => a.posicao - b.posicao);
  const ultimaAberta = quadro.colunas
    .filter((c) => c.papel !== "CONCLUIDA")
    .reduce((maior, c) => Math.max(maior, c.posicao), Number.NEGATIVE_INFINITY);
  const posicao =
    dados.papel !== "CONCLUIDA" && concluidas.length > 0
      ? posicaoEntre(Number.isFinite(ultimaAberta) ? ultimaAberta : null, concluidas[0].posicao) ?? posicaoNoFim(Math.max(...quadro.colunas.map((c) => c.posicao)))
      : posicaoNoFim(Math.max(0, ...quadro.colunas.map((c) => c.posicao)));
  const coluna = await prisma.colunaTarefas.create({
    data: { quadroId, nome: dados.nome, papel: dados.papel, limite: dados.limite ?? null, posicao },
    select: { id: true, nome: true, papel: true, posicao: true, limite: true },
  });
  return coluna;
}

export async function atualizarColuna(
  contexto: ContextoOperacao,
  id: string,
  dados: { nome?: string; papel?: PapelColunaTarefa; limite?: number | null }
): Promise<ColunaDto> {
  exigirAdministracao(contexto);
  const coluna = await colunaDaConta(contexto, id);
  if (dados.papel && dados.papel !== coluna.papel) {
    const irmas = await prisma.colunaTarefas.findMany({ where: { quadroId: coluna.quadroId, NOT: { id } }, select: { papel: true } });
    validarPapeis([...irmas.map((c) => c.papel), dados.papel]);
  }
  return prisma.$transaction(async (tx) => {
    const atualizada = await tx.colunaTarefas.update({
      where: { id },
      data: {
        ...(dados.nome !== undefined ? { nome: dados.nome } : {}),
        ...(dados.papel !== undefined ? { papel: dados.papel } : {}),
        ...(dados.limite !== undefined ? { limite: dados.limite } : {}),
      },
      select: { id: true, nome: true, papel: true, posicao: true, limite: true },
    });
    if (dados.papel && dados.papel !== coluna.papel) {
      await sincronizarConclusaoDaColuna(tx, id, dados.papel, contexto.userId);
    }
    return atualizada;
  });
}

export async function moverColuna(
  contexto: ContextoOperacao,
  id: string,
  destino: { anteriorId?: string | null; seguinteId?: string | null }
): Promise<ColunaDto[]> {
  exigirAdministracao(contexto);
  const coluna = await colunaDaConta(contexto, id);
  const irmas = await prisma.colunaTarefas.findMany({
    where: { quadroId: coluna.quadroId, NOT: { id } },
    orderBy: { posicao: "asc" },
    select: { id: true, posicao: true },
  });
  const antes = irmas.find((c) => c.id === destino.anteriorId)?.posicao ?? null;
  const depois = irmas.find((c) => c.id === destino.seguinteId)?.posicao ?? null;
  const posicao = antes === null && depois === null ? posicaoNoFim(irmas.at(-1)?.posicao) : posicaoEntre(antes, depois);
  await prisma.$transaction(async (tx) => {
    if (posicao === null) {
      const indice = irmas.findIndex((c) => c.id === destino.anteriorId);
      const ordem = [...irmas.slice(0, indice + 1).map((c) => c.id), id, ...irmas.slice(indice + 1).map((c) => c.id)];
      const novas = posicoesRenumeradas(ordem.length);
      for (const [i, colunaId] of ordem.entries()) await tx.colunaTarefas.update({ where: { id: colunaId }, data: { posicao: novas[i] } });
    } else {
      await tx.colunaTarefas.update({ where: { id }, data: { posicao } });
    }
  });
  return (await obterQuadro(contexto, coluna.quadroId)).colunas;
}

export async function apagarColuna(contexto: ContextoOperacao, id: string, destinoId: string | null | undefined): Promise<void> {
  exigirAdministracao(contexto);
  const coluna = await colunaDaConta(contexto, id);
  const irmas = await prisma.colunaTarefas.findMany({
    where: { quadroId: coluna.quadroId, NOT: { id } },
    select: { id: true, papel: true },
  });
  validarPapeis(irmas.map((c) => c.papel));
  const tarefas = await prisma.tarefa.count({ where: { colunaId: id } });
  let destino: { id: string; papel: PapelColunaTarefa } | undefined;
  if (tarefas > 0) {
    destino = irmas.find((c) => c.id === destinoId);
    if (!destino) throw regraOperacao("Escolha para qual coluna vão as tarefas desta.");
  }
  await prisma.$transaction(async (tx) => {
    if (destino) {
      const base = (await tx.tarefa.aggregate({ where: { colunaId: destino.id }, _max: { posicao: true } }))._max.posicao ?? 0;
      const lista = await tx.tarefa.findMany({ where: { colunaId: id }, orderBy: { posicao: "asc" }, select: { id: true } });
      for (const [indice, tarefa] of lista.entries()) {
        await tx.tarefa.update({ where: { id: tarefa.id }, data: { colunaId: destino.id, posicao: base + (indice + 1) * ESPACO_POSICAO } });
      }
      if (destino.papel !== coluna.papel && (destino.papel === "CONCLUIDA" || coluna.papel === "CONCLUIDA")) {
        await sincronizarConclusaoDaColuna(tx, destino.id, destino.papel, contexto.userId);
      }
    }
    await tx.colunaTarefas.delete({ where: { id } });
  });
}

export async function listarEtiquetas(contexto: ContextoOperacao): Promise<EtiquetaDto[]> {
  const etiquetas = await prisma.etiquetaTarefa.findMany({
    where: { contaId: contexto.contaId },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, cor: true },
  });
  return etiquetas.map(etiquetaDto);
}

async function nomeLivre(contaId: string, nome: string, exceto?: string): Promise<void> {
  const existente = await prisma.etiquetaTarefa.findFirst({
    where: { contaId, nome: { equals: nome, mode: "insensitive" }, ...(exceto ? { NOT: { id: exceto } } : {}) },
    select: { id: true },
  });
  if (existente) throw regraOperacao("Já existe uma etiqueta com esse nome.");
}

export async function criarEtiqueta(contexto: ContextoOperacao, dados: { nome: string; cor: CorOperacao }): Promise<EtiquetaDto> {
  exigirAdministracao(contexto);
  const total = await prisma.etiquetaTarefa.count({ where: { contaId: contexto.contaId } });
  if (total >= LIMITES.etiquetasPorConta) throw regraOperacao(`A loja pode ter até ${LIMITES.etiquetasPorConta} etiquetas.`);
  await nomeLivre(contexto.contaId, dados.nome);
  const etiqueta = await prisma.etiquetaTarefa.create({
    data: { contaId: contexto.contaId, nome: dados.nome, cor: dados.cor },
    select: { id: true, nome: true, cor: true },
  });
  return etiquetaDto(etiqueta);
}

export async function atualizarEtiqueta(
  contexto: ContextoOperacao,
  id: string,
  dados: { nome?: string; cor?: CorOperacao }
): Promise<EtiquetaDto> {
  exigirAdministracao(contexto);
  const etiqueta = await prisma.etiquetaTarefa.findFirst({ where: { id, contaId: contexto.contaId }, select: { id: true } });
  if (!etiqueta) throw naoEncontrada("Etiqueta");
  if (dados.nome) await nomeLivre(contexto.contaId, dados.nome, id);
  const atualizada = await prisma.etiquetaTarefa.update({ where: { id }, data: dados, select: { id: true, nome: true, cor: true } });
  return etiquetaDto(atualizada);
}

export async function apagarEtiqueta(contexto: ContextoOperacao, id: string): Promise<void> {
  exigirAdministracao(contexto);
  const { count } = await prisma.etiquetaTarefa.deleteMany({ where: { id, contaId: contexto.contaId } });
  if (count === 0) throw naoEncontrada("Etiqueta");
}
