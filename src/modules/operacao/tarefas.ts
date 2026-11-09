import { randomUUID } from "node:crypto";
import { Prisma, type OrigemTarefa, type TipoAtividadeTarefa } from "@prisma/client";
import { prisma, type ClienteTransacao } from "@/lib/prisma";
import { podeEditar } from "@/lib/permissoes";
import {
  type ContextoOperacao,
  exigirAdministracao,
  exigirEdicao,
  garantirEstruturaPadrao,
  nomeDaPessoa,
  proximoNumero,
} from "./contexto";
import type { EntradaAtualizarTarefa, EntradaCriarTarefa } from "./dominio/esquemas";
import { ESPACO_POSICAO, posicaoEntre, posicaoNoFim, posicaoNoInicio, posicoesRenumeradas } from "./dominio/posicao";
import { montarPrazo, partesDoPrazo } from "./dominio/prazo";
import { descreverRecorrencia, lerRecorrencia, proximoPrazo, type Recorrencia } from "./dominio/recorrencia";
import { conflitoVersao, naoEncontrada, regraOperacao } from "./erros";
import { avisarAtribuicao, avisarConclusao, type TarefaAviso } from "./avisos";
import {
  cartaoSelect,
  detalheCompletoSelect,
  pessoa,
  pessoaSelect,
  serializarCartao,
  serializarDetalheBase,
} from "./serializacao";
import type { CartaoTarefa, DetalheTarefa } from "./tipos";

export async function registrarAtividade(
  cliente: ClienteTransacao,
  tarefaId: string,
  autorId: string | null,
  tipo: TipoAtividadeTarefa,
  dados: Record<string, unknown> | null = null
): Promise<void> {
  await cliente.atividadeTarefa.create({
    data: { tarefaId, autorId, tipo, dados: dados === null ? Prisma.DbNull : (dados as Prisma.InputJsonValue) },
  });
}

export async function validarResponsavel(
  cliente: ClienteTransacao,
  contaId: string,
  responsavelId: string | null | undefined
): Promise<string | null | undefined> {
  if (responsavelId === undefined || responsavelId === null) return responsavelId;
  const encontrado = await cliente.user.findFirst({
    where: { id: responsavelId, OR: [{ id: contaId }, { contaId }], bloqueadoEm: null },
    select: { role: true },
  });
  if (!encontrado) throw regraOperacao("Essa pessoa não faz parte da equipe.");
  if (!podeEditar(encontrado.role, "TAREFAS_EDITAR")) {
    throw regraOperacao("Quem tem acesso só de leitura não pode ser responsável por tarefas.");
  }
  return responsavelId;
}

export async function validarEtiquetas(
  cliente: ClienteTransacao,
  contaId: string,
  etiquetaIds: string[] | undefined
): Promise<string[] | undefined> {
  if (etiquetaIds === undefined) return undefined;
  const unicas = [...new Set(etiquetaIds)];
  if (unicas.length === 0) return [];
  const encontradas = await cliente.etiquetaTarefa.count({ where: { id: { in: unicas }, contaId } });
  if (encontradas !== unicas.length) throw regraOperacao("Etiqueta não encontrada.");
  return unicas;
}

function prazoDaEntrada(entrada: { data: string; hora?: string | null } | null | undefined) {
  if (entrada === undefined) return undefined;
  if (entrada === null) return null;
  const prazo = montarPrazo(entrada.data, entrada.hora ?? null);
  if (!prazo) throw regraOperacao("Prazo inválido.");
  return prazo;
}

async function resolverColuna(contexto: ContextoOperacao, quadroId?: string, colunaId?: string) {
  if (colunaId) {
    const coluna = await prisma.colunaTarefas.findFirst({
      where: { id: colunaId, quadro: { contaId: contexto.contaId, arquivadoEm: null } },
      select: { id: true, papel: true, quadroId: true },
    });
    if (!coluna || (quadroId && coluna.quadroId !== quadroId)) throw naoEncontrada("Coluna");
    return coluna;
  }
  const buscarQuadro = () =>
    prisma.quadroTarefas.findFirst({
      where: { contaId: contexto.contaId, arquivadoEm: null, ...(quadroId ? { id: quadroId } : {}) },
      orderBy: [{ padrao: "desc" }, { posicao: "asc" }],
      select: { id: true, colunas: { select: { id: true, papel: true, posicao: true }, orderBy: { posicao: "asc" } } },
    });
  let quadro = await buscarQuadro();
  if (!quadro && !quadroId) {
    await garantirEstruturaPadrao(contexto.contaId, contexto.userId);
    quadro = await buscarQuadro();
  }
  if (!quadro) throw naoEncontrada("Quadro");
  const coluna = quadro.colunas.find((c) => c.papel === "A_FAZER") ?? quadro.colunas[0];
  if (!coluna) throw regraOperacao("O quadro não tem colunas.");
  return { id: coluna.id, papel: coluna.papel, quadroId: quadro.id };
}

async function ultimaPosicao(cliente: ClienteTransacao, colunaId: string): Promise<number | null> {
  const agregado = await cliente.tarefa.aggregate({ where: { colunaId }, _max: { posicao: true } });
  return agregado._max.posicao;
}

async function primeiraPosicao(cliente: ClienteTransacao, colunaId: string): Promise<number | null> {
  const agregado = await cliente.tarefa.aggregate({ where: { colunaId }, _min: { posicao: true } });
  return agregado._min.posicao;
}

async function cartao(id: string, cliente: ClienteTransacao = prisma): Promise<CartaoTarefa> {
  const tarefa = await cliente.tarefa.findUniqueOrThrow({ where: { id }, select: cartaoSelect });
  return serializarCartao(tarefa);
}

async function validarNota(contexto: ContextoOperacao, notaId: string | undefined): Promise<string | undefined> {
  if (!notaId) return undefined;
  const nota = await prisma.notaOperacao.findFirst({
    where: { id: notaId, contaId: contexto.contaId, OR: [{ visibilidade: "EQUIPE" }, { autorId: contexto.userId }] },
    select: { id: true },
  });
  if (!nota) throw naoEncontrada("Nota");
  return nota.id;
}

function ehChaveDuplicada(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export interface ResultadoCriacao {
  tarefa: CartaoTarefa;
  existente: boolean;
}

export async function criarTarefa(
  contexto: ContextoOperacao,
  entrada: EntradaCriarTarefa,
  opcoes: { origem?: OrigemTarefa } = {}
): Promise<ResultadoCriacao> {
  exigirEdicao(contexto);
  const { contaId } = contexto;

  if (entrada.chaveOrigem) {
    const existente = await prisma.tarefa.findUnique({
      where: { contaId_chaveOrigem: { contaId, chaveOrigem: entrada.chaveOrigem } },
      select: { id: true, numero: true, concluidaEm: true, arquivadaEm: true },
    });
    if (existente && !existente.concluidaEm && !existente.arquivadaEm) {
      return { tarefa: await cartao(existente.id), existente: true };
    }
    if (existente) {
      await prisma.tarefa.update({ where: { id: existente.id }, data: { chaveOrigem: `${entrada.chaveOrigem}#${existente.numero}` } });
    }
  }

  const coluna = await resolverColuna(contexto, entrada.quadroId, entrada.colunaId);
  const responsavelId = await validarResponsavel(prisma, contaId, entrada.responsavelId);
  const etiquetaIds = (await validarEtiquetas(prisma, contaId, entrada.etiquetaIds)) ?? [];
  const prazo = prazoDaEntrada(entrada.prazo);
  const recorrencia = entrada.recorrencia ?? null;
  if (recorrencia && !prazo) throw regraOperacao("Para repetir a tarefa, defina o primeiro prazo.");
  const notaId = await validarNota(contexto, entrada.notaId);
  const origem = opcoes.origem ?? entrada.origem ?? "MANUAL";
  const agora = new Date();

  let id: string;
  try {
    id = await prisma.$transaction(async (tx) => {
      const numero = await proximoNumero(tx, contaId, "tarefa");
      const posicao = posicaoNoFim(await ultimaPosicao(tx, coluna.id));
      const concluida = coluna.papel === "CONCLUIDA";
      const criada = await tx.tarefa.create({
        data: {
          contaId,
          numero,
          quadroId: coluna.quadroId,
          colunaId: coluna.id,
          titulo: entrada.titulo,
          descricao: entrada.descricao?.trim() || null,
          prioridade: entrada.prioridade ?? "MEDIA",
          posicao,
          responsavelId: responsavelId ?? null,
          criadoPorId: contexto.userId,
          prazo: prazo?.prazo ?? null,
          prazoComHora: prazo?.prazoComHora ?? false,
          concluidaEm: concluida ? agora : null,
          concluidaPorId: concluida ? contexto.userId : null,
          origem,
          chaveOrigem: entrada.chaveOrigem ?? null,
          vinculoTipo: entrada.vinculo?.tipo ?? null,
          vinculoId: entrada.vinculo?.id ?? null,
          vinculoRotulo: entrada.vinculo?.rotulo ?? null,
          vinculoHref: entrada.vinculo?.href ?? null,
          recorrencia: recorrencia ? (recorrencia as Prisma.InputJsonValue) : Prisma.DbNull,
          serieId: recorrencia ? randomUUID() : null,
          etiquetas: { create: etiquetaIds.map((etiquetaId) => ({ etiquetaId })) },
          checklist: {
            create: (entrada.checklist ?? []).map((texto, indice) => ({ texto, posicao: (indice + 1) * ESPACO_POSICAO })),
          },
        },
        select: { id: true },
      });
      await registrarAtividade(tx, criada.id, contexto.userId, "CRIADA", { origem });
      if (notaId) await tx.notaOperacao.update({ where: { id: notaId }, data: { tarefaId: criada.id } });
      return criada.id;
    });
  } catch (error) {
    if (entrada.chaveOrigem && ehChaveDuplicada(error)) {
      const existente = await prisma.tarefa.findUnique({
        where: { contaId_chaveOrigem: { contaId, chaveOrigem: entrada.chaveOrigem } },
        select: { id: true },
      });
      if (existente) return { tarefa: await cartao(existente.id), existente: true };
    }
    throw error;
  }

  const criada = await cartao(id);
  await avisarAtribuicao(
    { id, numero: criada.numero, titulo: criada.titulo, responsavelId: responsavelId ?? null, criadoPorId: contexto.userId },
    contexto
  );
  return { tarefa: criada, existente: false };
}

export async function detalharTarefa(contexto: ContextoOperacao, id: string): Promise<DetalheTarefa> {
  const tarefa = await prisma.tarefa.findFirst({ where: { id, contaId: contexto.contaId }, select: detalheCompletoSelect });
  if (!tarefa) throw naoEncontrada();
  const [itens, comentarios, atividades] = await Promise.all([
    prisma.itemChecklistTarefa.findMany({
      where: { tarefaId: id },
      orderBy: { posicao: "asc" },
      select: { id: true, texto: true, concluido: true, posicao: true, concluidoEm: true, concluidoPor: { select: pessoaSelect } },
    }),
    prisma.comentarioTarefa.findMany({
      where: { tarefaId: id },
      orderBy: { createdAt: "asc" },
      take: 300,
      select: { id: true, corpo: true, autorId: true, createdAt: true, editadoEm: true, autor: { select: pessoaSelect } },
    }),
    prisma.atividadeTarefa.findMany({
      where: { tarefaId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, tipo: true, dados: true, createdAt: true, autor: { select: pessoaSelect } },
    }),
  ]);
  return {
    ...serializarDetalheBase(tarefa),
    itensChecklist: itens.map((item) => ({
      id: item.id,
      texto: item.texto,
      concluido: item.concluido,
      posicao: item.posicao,
      concluidoPor: pessoa(item.concluidoPor),
      concluidoEm: item.concluidoEm?.toISOString() ?? null,
    })),
    listaComentarios: comentarios.map((comentario) => ({
      id: comentario.id,
      corpo: comentario.corpo,
      autor: pessoa(comentario.autor),
      criadoEm: comentario.createdAt.toISOString(),
      editadoEm: comentario.editadoEm?.toISOString() ?? null,
      podeEditar: contexto.podeEditar && comentario.autorId === contexto.userId,
      podeApagar: contexto.podeEditar && (comentario.autorId === contexto.userId || contexto.podeAdministrar),
    })),
    atividades: atividades.map((atividade) => ({
      id: atividade.id,
      tipo: atividade.tipo,
      autor: pessoa(atividade.autor),
      dados: (atividade.dados as Record<string, unknown> | null) ?? null,
      criadoEm: atividade.createdAt.toISOString(),
    })),
  };
}

async function nomesDe(ids: Array<string | null>): Promise<Map<string, string>> {
  const validos = ids.filter((id): id is string => Boolean(id));
  if (validos.length === 0) return new Map();
  const pessoas = await prisma.user.findMany({ where: { id: { in: validos } }, select: { id: true, name: true, email: true } });
  return new Map(pessoas.map((p) => [p.id, nomeDaPessoa(p)]));
}

function prazoTexto(prazo: Date | null, comHora: boolean): string | null {
  if (!prazo) return null;
  const partes = partesDoPrazo(prazo, comHora);
  return partes.hora ? `${partes.data} ${partes.hora}` : partes.data;
}

export async function atualizarTarefa(contexto: ContextoOperacao, id: string, entrada: EntradaAtualizarTarefa): Promise<CartaoTarefa> {
  exigirEdicao(contexto);
  const atual = await prisma.tarefa.findFirst({
    where: { id, contaId: contexto.contaId },
    select: {
      id: true,
      numero: true,
      titulo: true,
      descricao: true,
      prioridade: true,
      responsavelId: true,
      criadoPorId: true,
      prazo: true,
      prazoComHora: true,
      recorrencia: true,
      serieId: true,
      versao: true,
      vinculoHref: true,
      etiquetas: { select: { etiqueta: { select: { id: true, nome: true } } } },
    },
  });
  if (!atual) throw naoEncontrada();
  if (entrada.versao !== undefined && entrada.versao !== atual.versao) throw conflitoVersao();

  const responsavelId = await validarResponsavel(prisma, contexto.contaId, entrada.responsavelId);
  const etiquetaIds = await validarEtiquetas(prisma, contexto.contaId, entrada.etiquetaIds);
  const prazo = prazoDaEntrada(entrada.prazo);
  const recorrenciaAtual = lerRecorrencia(atual.recorrencia);
  const recorrencia: Recorrencia | null = entrada.recorrencia === undefined ? recorrenciaAtual : entrada.recorrencia;
  const prazoFinal = prazo === undefined ? atual.prazo : prazo?.prazo ?? null;
  if (recorrencia && !prazoFinal) throw regraOperacao("Para repetir a tarefa, defina o prazo.");

  const dados: Prisma.TarefaUncheckedUpdateManyInput = { versao: { increment: 1 } };
  const atividades: Array<{ tipo: TipoAtividadeTarefa; dados: Record<string, unknown> }> = [];

  if (entrada.titulo !== undefined && entrada.titulo !== atual.titulo) {
    dados.titulo = entrada.titulo;
    atividades.push({ tipo: "EDITADA", dados: { campo: "titulo", de: atual.titulo, para: entrada.titulo } });
  }
  if (entrada.descricao !== undefined) {
    const descricao = entrada.descricao?.trim() || null;
    if (descricao !== atual.descricao) {
      dados.descricao = descricao;
      atividades.push({ tipo: "EDITADA", dados: { campo: "descricao" } });
    }
  }
  if (entrada.prioridade !== undefined && entrada.prioridade !== atual.prioridade) {
    dados.prioridade = entrada.prioridade;
    atividades.push({ tipo: "PRIORIDADE", dados: { de: atual.prioridade, para: entrada.prioridade } });
  }
  let novoResponsavel = false;
  if (responsavelId !== undefined && responsavelId !== atual.responsavelId) {
    dados.responsavelId = responsavelId;
    novoResponsavel = responsavelId !== null;
    const nomes = await nomesDe([atual.responsavelId, responsavelId]);
    atividades.push({
      tipo: "ATRIBUIDA",
      dados: {
        de: atual.responsavelId ? nomes.get(atual.responsavelId) ?? null : null,
        para: responsavelId ? nomes.get(responsavelId) ?? null : null,
      },
    });
  }
  if (prazo !== undefined) {
    const anterior = prazoTexto(atual.prazo, atual.prazoComHora);
    const novo = prazo ? prazoTexto(prazo.prazo, prazo.prazoComHora) : null;
    if (anterior !== novo) {
      dados.prazo = prazo?.prazo ?? null;
      dados.prazoComHora = prazo?.prazoComHora ?? false;
      atividades.push({ tipo: "PRAZO", dados: { de: anterior, para: novo } });
    }
  }
  if (entrada.recorrencia !== undefined && JSON.stringify(entrada.recorrencia) !== JSON.stringify(recorrenciaAtual)) {
    dados.recorrencia = entrada.recorrencia ? (entrada.recorrencia as Prisma.InputJsonValue) : Prisma.DbNull;
    if (entrada.recorrencia && !atual.serieId) dados.serieId = randomUUID();
    atividades.push({ tipo: "RECORRENCIA", dados: { texto: entrada.recorrencia ? descreverRecorrencia(entrada.recorrencia) : null } });
  }
  if (entrada.vinculo !== undefined) {
    dados.vinculoTipo = entrada.vinculo?.tipo ?? null;
    dados.vinculoId = entrada.vinculo?.id ?? null;
    dados.vinculoRotulo = entrada.vinculo?.rotulo ?? null;
    dados.vinculoHref = entrada.vinculo?.href ?? null;
  }
  let mudancaEtiquetas: { adicionadas: string[]; removidas: string[] } | null = null;
  if (etiquetaIds !== undefined) {
    const antes = new Set(atual.etiquetas.map((e) => e.etiqueta.id));
    const depois = new Set(etiquetaIds);
    const adicionadas = etiquetaIds.filter((e) => !antes.has(e));
    const removidas = [...antes].filter((e) => !depois.has(e));
    if (adicionadas.length > 0 || removidas.length > 0) {
      const nomes = new Map(
        (await prisma.etiquetaTarefa.findMany({ where: { id: { in: [...adicionadas, ...removidas] } }, select: { id: true, nome: true } })).map(
          (e) => [e.id, e.nome]
        )
      );
      mudancaEtiquetas = { adicionadas: adicionadas.map((e) => nomes.get(e) ?? ""), removidas: removidas.map((e) => nomes.get(e) ?? "") };
      atividades.push({ tipo: "ETIQUETAS", dados: mudancaEtiquetas });
    }
  }

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.tarefa.updateMany({
      where: entrada.versao === undefined ? { id } : { id, versao: atual.versao },
      data: dados,
    });
    if (count === 0) throw conflitoVersao();
    if (etiquetaIds !== undefined && mudancaEtiquetas) {
      await tx.tarefaEtiqueta.deleteMany({ where: { tarefaId: id } });
      if (etiquetaIds.length > 0) {
        await tx.tarefaEtiqueta.createMany({ data: etiquetaIds.map((etiquetaId) => ({ tarefaId: id, etiquetaId })) });
      }
    }
    for (const atividade of atividades) await registrarAtividade(tx, id, contexto.userId, atividade.tipo, atividade.dados);
  });

  const resultado = await cartao(id);
  if (novoResponsavel) {
    await avisarAtribuicao(
      { id, numero: atual.numero, titulo: resultado.titulo, responsavelId: responsavelId ?? null, criadoPorId: atual.criadoPorId },
      contexto
    );
  }
  return resultado;
}

const conclusaoSelect = {
  id: true,
  numero: true,
  titulo: true,
  descricao: true,
  prioridade: true,
  quadroId: true,
  colunaId: true,
  responsavelId: true,
  criadoPorId: true,
  prazo: true,
  prazoComHora: true,
  concluidaEm: true,
  recorrencia: true,
  serieId: true,
  chaveOrigem: true,
  vinculoTipo: true,
  vinculoId: true,
  vinculoRotulo: true,
  vinculoHref: true,
  coluna: { select: { nome: true, papel: true } },
  etiquetas: { select: { etiquetaId: true } },
  checklist: { select: { texto: true, posicao: true }, orderBy: { posicao: "asc" as const } },
} satisfies Prisma.TarefaSelect;

type TarefaParaConclusao = Prisma.TarefaGetPayload<{ select: typeof conclusaoSelect }>;

async function gerarProximaOcorrencia(
  tx: ClienteTransacao,
  contexto: ContextoOperacao,
  tarefa: TarefaParaConclusao,
  agora: Date
): Promise<string | null> {
  const recorrencia = lerRecorrencia(tarefa.recorrencia);
  if (!recorrencia || !tarefa.prazo) return null;
  const prazo = proximoPrazo(recorrencia, tarefa.prazo, tarefa.prazoComHora, agora);
  if (!prazo) return null;
  const serieId = tarefa.serieId ?? randomUUID();
  if (!tarefa.serieId) await tx.tarefa.update({ where: { id: tarefa.id }, data: { serieId } });
  const jaExiste = await tx.tarefa.findUnique({ where: { serieId_prazo: { serieId, prazo } }, select: { id: true } });
  if (jaExiste) return null;
  const coluna =
    (await tx.colunaTarefas.findFirst({ where: { quadroId: tarefa.quadroId, papel: "A_FAZER" }, orderBy: { posicao: "asc" }, select: { id: true } })) ??
    (await tx.colunaTarefas.findFirst({ where: { quadroId: tarefa.quadroId }, orderBy: { posicao: "asc" }, select: { id: true } }));
  if (!coluna) return null;
  const numero = await proximoNumero(tx, contexto.contaId, "tarefa");
  if (tarefa.chaveOrigem) {
    await tx.tarefa.update({ where: { id: tarefa.id }, data: { chaveOrigem: `${tarefa.chaveOrigem}#${tarefa.numero}` } });
  }
  const nova = await tx.tarefa.create({
    data: {
      contaId: contexto.contaId,
      numero,
      quadroId: tarefa.quadroId,
      colunaId: coluna.id,
      chaveOrigem: tarefa.chaveOrigem,
      titulo: tarefa.titulo,
      descricao: tarefa.descricao,
      prioridade: tarefa.prioridade,
      posicao: posicaoNoFim(await ultimaPosicao(tx, coluna.id)),
      responsavelId: tarefa.responsavelId,
      criadoPorId: tarefa.criadoPorId,
      prazo,
      prazoComHora: tarefa.prazoComHora,
      origem: "RECORRENCIA",
      vinculoTipo: tarefa.vinculoTipo,
      vinculoId: tarefa.vinculoId,
      vinculoRotulo: tarefa.vinculoRotulo,
      vinculoHref: tarefa.vinculoHref,
      recorrencia: recorrencia as Prisma.InputJsonValue,
      serieId,
      etiquetas: { create: tarefa.etiquetas.map((e) => ({ etiquetaId: e.etiquetaId })) },
      checklist: { create: tarefa.checklist.map((item) => ({ texto: item.texto, posicao: item.posicao })) },
    },
    select: { id: true },
  });
  await registrarAtividade(tx, nova.id, contexto.userId, "CRIADA", { origem: "RECORRENCIA", anterior: tarefa.numero });
  return nova.id;
}

export interface ResultadoMovimento {
  tarefa: CartaoTarefa;
  proxima: CartaoTarefa | null;
  aviso: string | null;
}

export async function moverTarefa(
  contexto: ContextoOperacao,
  id: string,
  destino: { colunaId: string; anteriorId?: string | null; seguinteId?: string | null }
): Promise<ResultadoMovimento> {
  exigirEdicao(contexto);
  const tarefa = await prisma.tarefa.findFirst({ where: { id, contaId: contexto.contaId, arquivadaEm: null }, select: conclusaoSelect });
  if (!tarefa) throw naoEncontrada();
  const coluna = await prisma.colunaTarefas.findFirst({
    where: { id: destino.colunaId, quadro: { contaId: contexto.contaId, arquivadoEm: null } },
    select: { id: true, nome: true, papel: true, limite: true, quadroId: true },
  });
  if (!coluna) throw naoEncontrada("Coluna");

  const agora = new Date();
  const entrandoConcluida = coluna.papel === "CONCLUIDA" && !tarefa.concluidaEm;
  const saindoConcluida = coluna.papel !== "CONCLUIDA" && Boolean(tarefa.concluidaEm);

  const proximaId = await prisma.$transaction(async (tx) => {
    const vizinhosIds = [destino.anteriorId, destino.seguinteId].filter((v): v is string => Boolean(v) && v !== id);
    const vizinhos = vizinhosIds.length
      ? await tx.tarefa.findMany({ where: { id: { in: vizinhosIds }, colunaId: coluna.id, contaId: contexto.contaId }, select: { id: true, posicao: true } })
      : [];
    const antes = vizinhos.find((v) => v.id === destino.anteriorId)?.posicao ?? null;
    const depois = vizinhos.find((v) => v.id === destino.seguinteId)?.posicao ?? null;
    let posicao: number | null;
    if (antes === null && depois === null) {
      posicao = destino.seguinteId && !destino.anteriorId
        ? posicaoNoInicio(await primeiraPosicao(tx, coluna.id))
        : posicaoNoFim(await ultimaPosicao(tx, coluna.id));
    } else {
      posicao = posicaoEntre(antes, depois);
    }
    if (posicao === null) {
      const ordem = await tx.tarefa.findMany({
        where: { colunaId: coluna.id, NOT: { id } },
        orderBy: { posicao: "asc" },
        select: { id: true },
      });
      const novas = posicoesRenumeradas(ordem.length);
      for (const [indice, item] of ordem.entries()) {
        await tx.tarefa.update({ where: { id: item.id }, data: { posicao: novas[indice] } });
      }
      const indiceAnterior = ordem.findIndex((item) => item.id === destino.anteriorId);
      posicao = indiceAnterior >= 0 ? novas[indiceAnterior] + ESPACO_POSICAO / 2 : ESPACO_POSICAO / 2;
    }

    await tx.tarefa.update({
      where: { id },
      data: {
        colunaId: coluna.id,
        quadroId: coluna.quadroId,
        posicao,
        versao: { increment: 1 },
        ...(entrandoConcluida ? { concluidaEm: agora, concluidaPorId: contexto.userId } : {}),
        ...(saindoConcluida ? { concluidaEm: null, concluidaPorId: null } : {}),
      },
    });
    if (coluna.id !== tarefa.colunaId) {
      await registrarAtividade(tx, id, contexto.userId, "MOVIDA", { de: tarefa.coluna.nome, para: coluna.nome });
    }
    if (saindoConcluida) await registrarAtividade(tx, id, contexto.userId, "REABERTA");
    if (entrandoConcluida) {
      await registrarAtividade(tx, id, contexto.userId, "CONCLUIDA");
      return gerarProximaOcorrencia(tx, contexto, tarefa, agora);
    }
    return null;
  });

  let aviso: string | null = null;
  if (coluna.limite && coluna.id !== tarefa.colunaId) {
    const naColuna = await prisma.tarefa.count({ where: { colunaId: coluna.id, arquivadaEm: null } });
    if (naColuna > coluna.limite) aviso = `A coluna ${coluna.nome} passou do limite de ${coluna.limite} tarefas.`;
  }

  const resultado = await cartao(id);
  if (entrandoConcluida) {
    await avisarConclusao(avisoDe(tarefa), contexto);
  }
  return { tarefa: resultado, proxima: proximaId ? await cartao(proximaId) : null, aviso };
}

function avisoDe(tarefa: { id: string; numero: number; titulo: string; responsavelId: string | null; criadoPorId: string | null }): TarefaAviso {
  return { id: tarefa.id, numero: tarefa.numero, titulo: tarefa.titulo, responsavelId: tarefa.responsavelId, criadoPorId: tarefa.criadoPorId };
}

async function colunaPorPapel(quadroId: string, papel: "A_FAZER" | "CONCLUIDA") {
  return prisma.colunaTarefas.findFirst({ where: { quadroId, papel }, orderBy: { posicao: "asc" }, select: { id: true } });
}

async function primeiraDaColuna(colunaId: string, exceto: string): Promise<string | null> {
  const primeira = await prisma.tarefa.findFirst({
    where: { colunaId, NOT: { id: exceto } },
    orderBy: { posicao: "asc" },
    select: { id: true },
  });
  return primeira?.id ?? null;
}

export type AcaoTarefa = "concluir" | "reabrir" | "arquivar" | "restaurar" | "duplicar";

export async function executarAcao(contexto: ContextoOperacao, id: string, acao: AcaoTarefa): Promise<ResultadoMovimento> {
  exigirEdicao(contexto);
  const tarefa = await prisma.tarefa.findFirst({
    where: { id, contaId: contexto.contaId },
    select: { id: true, quadroId: true, colunaId: true, concluidaEm: true, arquivadaEm: true },
  });
  if (!tarefa) throw naoEncontrada();

  if (acao === "concluir" || acao === "reabrir") {
    if (tarefa.arquivadaEm) throw regraOperacao("Restaure a tarefa antes de mexer nela.");
    if ((acao === "concluir") === Boolean(tarefa.concluidaEm)) return { tarefa: await cartao(id), proxima: null, aviso: null };
    const coluna = await colunaPorPapel(tarefa.quadroId, acao === "concluir" ? "CONCLUIDA" : "A_FAZER");
    if (!coluna) throw regraOperacao(acao === "concluir" ? "O quadro não tem coluna de concluídas." : "O quadro não tem coluna de a fazer.");
    return moverTarefa(contexto, id, { colunaId: coluna.id, seguinteId: await primeiraDaColuna(coluna.id, id) });
  }

  if (acao === "arquivar" || acao === "restaurar") {
    const arquivar = acao === "arquivar";
    if (arquivar === Boolean(tarefa.arquivadaEm)) return { tarefa: await cartao(id), proxima: null, aviso: null };
    await prisma.$transaction(async (tx) => {
      await tx.tarefa.update({ where: { id }, data: { arquivadaEm: arquivar ? new Date() : null, versao: { increment: 1 } } });
      await registrarAtividade(tx, id, contexto.userId, arquivar ? "ARQUIVADA" : "RESTAURADA");
    });
    return { tarefa: await cartao(id), proxima: null, aviso: null };
  }

  const original = await prisma.tarefa.findUniqueOrThrow({
    where: { id },
    select: {
      titulo: true,
      descricao: true,
      prioridade: true,
      responsavelId: true,
      prazo: true,
      prazoComHora: true,
      vinculoTipo: true,
      vinculoId: true,
      vinculoRotulo: true,
      vinculoHref: true,
      posicao: true,
      coluna: { select: { papel: true } },
      etiquetas: { select: { etiquetaId: true } },
      checklist: { select: { texto: true, posicao: true } },
    },
  });
  const destino = original.coluna.papel === "CONCLUIDA" ? await colunaPorPapel(tarefa.quadroId, "A_FAZER") : { id: tarefa.colunaId };
  if (!destino) throw regraOperacao("O quadro não tem coluna de a fazer.");
  const copiaId = await prisma.$transaction(async (tx) => {
    const numero = await proximoNumero(tx, contexto.contaId, "tarefa");
    const seguinte = await tx.tarefa.findFirst({
      where: { colunaId: destino.id, posicao: { gt: original.posicao } },
      orderBy: { posicao: "asc" },
      select: { posicao: true },
    });
    const posicao =
      destino.id === tarefa.colunaId
        ? posicaoEntre(original.posicao, seguinte?.posicao ?? null) ?? posicaoNoFim(await ultimaPosicao(tx, destino.id))
        : posicaoNoFim(await ultimaPosicao(tx, destino.id));
    const copia = await tx.tarefa.create({
      data: {
        contaId: contexto.contaId,
        numero,
        quadroId: tarefa.quadroId,
        colunaId: destino.id,
        titulo: `${original.titulo} (cópia)`.slice(0, 200),
        descricao: original.descricao,
        prioridade: original.prioridade,
        posicao,
        responsavelId: original.responsavelId,
        criadoPorId: contexto.userId,
        prazo: original.prazo,
        prazoComHora: original.prazoComHora,
        origem: "MANUAL",
        vinculoTipo: original.vinculoTipo,
        vinculoId: original.vinculoId,
        vinculoRotulo: original.vinculoRotulo,
        vinculoHref: original.vinculoHref,
        etiquetas: { create: original.etiquetas.map((e) => ({ etiquetaId: e.etiquetaId })) },
        checklist: { create: original.checklist.map((item) => ({ texto: item.texto, posicao: item.posicao })) },
      },
      select: { id: true },
    });
    await registrarAtividade(tx, copia.id, contexto.userId, "CRIADA", { origem: "DUPLICADA" });
    return copia.id;
  });
  return { tarefa: await cartao(copiaId), proxima: null, aviso: null };
}

export async function excluirTarefa(contexto: ContextoOperacao, id: string): Promise<void> {
  exigirAdministracao(contexto);
  const tarefa = await prisma.tarefa.findFirst({ where: { id, contaId: contexto.contaId }, select: { arquivadaEm: true } });
  if (!tarefa) throw naoEncontrada();
  if (!tarefa.arquivadaEm) throw regraOperacao("Arquive a tarefa antes de excluir de vez.");
  await prisma.tarefa.delete({ where: { id } });
}

export async function obterCartao(contexto: ContextoOperacao, id: string): Promise<CartaoTarefa> {
  const tarefa = await prisma.tarefa.findFirst({ where: { id, contaId: contexto.contaId }, select: cartaoSelect });
  if (!tarefa) throw naoEncontrada();
  return serializarCartao(tarefa);
}
