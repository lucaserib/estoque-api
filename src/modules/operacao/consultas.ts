import { prisma } from "@/lib/prisma";
import { fimDoDia, inicioDaSemana } from "@/modules/financeiro/dominio/periodo";
import { type ContextoOperacao, membrosDaConta } from "./contexto";
import type { FiltrosTarefas } from "./dominio/esquemas";
import { naoEncontrada } from "./erros";
import { type FiltrosBasicos, filtroDeSituacao, montarFiltro, ordenacao } from "./filtros";
import { listarEtiquetas, listarQuadros } from "./quadros";
import { cartaoSelect, quadroDto, serializarCartao } from "./serializacao";
import type { InicioOperacao, PaginaTarefas, QuadroCompleto, ResumoOperacao, ResumoPessoa } from "./tipos";

const DIA_MS = 24 * 60 * 60 * 1000;
export const DIAS_CONCLUIDAS_NO_QUADRO = 14;
const MAXIMO_POR_COLUNA = 300;

export async function inicioOperacao(contexto: ContextoOperacao): Promise<InicioOperacao> {
  const quadros = await listarQuadros(contexto);
  const [etiquetas, membros, eu] = await Promise.all([
    listarEtiquetas(contexto),
    membrosDaConta(contexto.contaId),
    prisma.user.findUnique({ where: { id: contexto.userId }, select: { image: true } }),
  ]);
  return {
    usuario: {
      id: contexto.userId,
      nome: contexto.nome,
      imagem: eu?.image ?? null,
      podeEditar: contexto.podeEditar,
      podeAdministrar: contexto.podeAdministrar,
    },
    quadros,
    etiquetas,
    membros: membros.map((m) => ({ id: m.id, nome: m.nome, imagem: m.imagem, email: m.email, papel: m.papel, podeEditar: m.podeEditar })),
  };
}

export async function carregarQuadro(
  contexto: ContextoOperacao,
  quadroId: string,
  filtros: FiltrosBasicos & { mostrarConcluidas?: boolean },
  agora: Date = new Date()
): Promise<QuadroCompleto> {
  const quadro = await prisma.quadroTarefas.findFirst({
    where: { id: quadroId, contaId: contexto.contaId },
    select: {
      id: true,
      nome: true,
      descricao: true,
      cor: true,
      padrao: true,
      arquivadoEm: true,
      colunas: { select: { id: true, nome: true, papel: true, posicao: true, limite: true } },
    },
  });
  if (!quadro) throw naoEncontrada("Quadro");
  const dto = quadroDto(quadro);
  const filtroBase = montarFiltro(contexto, { ...filtros, situacao: filtros.situacao ?? "todas", quadroId }, agora);
  const limiteConcluidas = new Date(agora.getTime() - DIAS_CONCLUIDAS_NO_QUADRO * DIA_MS);

  const colunas = await Promise.all(
    dto.colunas.map(async (coluna) => {
      const naColuna = { AND: [filtroBase, { colunaId: coluna.id }] };
      const visiveis =
        coluna.papel === "CONCLUIDA" && !filtros.mostrarConcluidas
          ? { AND: [naColuna, { OR: [{ concluidaEm: null }, { concluidaEm: { gte: limiteConcluidas } }] }] }
          : naColuna;
      const [tarefas, total] = await Promise.all([
        prisma.tarefa.findMany({ where: visiveis, orderBy: { posicao: "asc" }, take: MAXIMO_POR_COLUNA, select: cartaoSelect }),
        prisma.tarefa.count({ where: naColuna }),
      ]);
      return {
        ...coluna,
        tarefas: tarefas.map((t) => serializarCartao(t, agora)),
        total,
        ocultas: Math.max(0, total - tarefas.length),
      };
    })
  );
  return { quadro: dto, colunas };
}

export async function listarTarefas(contexto: ContextoOperacao, filtros: FiltrosTarefas, agora: Date = new Date()): Promise<PaginaTarefas> {
  const where = montarFiltro(contexto, filtros, agora);
  const [itens, total] = await Promise.all([
    prisma.tarefa.findMany({
      where,
      orderBy: ordenacao(filtros.ordem),
      skip: (filtros.pagina - 1) * filtros.porPagina,
      take: filtros.porPagina,
      select: cartaoSelect,
    }),
    prisma.tarefa.count({ where }),
  ]);
  return { itens: itens.map((t) => serializarCartao(t, agora)), total, pagina: filtros.pagina, porPagina: filtros.porPagina };
}

export async function resumoOperacao(contexto: ContextoOperacao, agora: Date = new Date()): Promise<ResumoOperacao> {
  const base = { contaId: contexto.contaId, quadro: { arquivadoEm: null } };
  const minhas = { ...base, responsavelId: contexto.userId };
  const semana = inicioDaSemana(agora);
  const contar = (situacao: FiltrosTarefas["situacao"]) => prisma.tarefa.count({ where: { ...minhas, ...filtroDeSituacao(situacao, agora) } });

  const [atrasadas, hoje, proximos7Dias, semPrazo, concluidasSemana, semResponsavel] = await Promise.all([
    contar("atrasadas"),
    contar("hoje"),
    contar("semana"),
    contar("sem-prazo"),
    prisma.tarefa.count({ where: { ...minhas, concluidaEm: { gte: semana }, arquivadaEm: null } }),
    prisma.tarefa.count({ where: { ...base, responsavelId: null, concluidaEm: null, arquivadaEm: null } }),
  ]);

  let equipe: ResumoPessoa[] | null = null;
  if (contexto.podeAdministrar) {
    const [membros, abertas, vencidas, feitas] = await Promise.all([
      membrosDaConta(contexto.contaId),
      prisma.tarefa.groupBy({ by: ["responsavelId"], where: { ...base, concluidaEm: null, arquivadaEm: null }, _count: { _all: true } }),
      prisma.tarefa.groupBy({
        by: ["responsavelId"],
        where: { ...base, concluidaEm: null, arquivadaEm: null, prazo: { lt: agora } },
        _count: { _all: true },
      }),
      prisma.tarefa.groupBy({
        by: ["responsavelId"],
        where: { ...base, concluidaEm: { gte: new Date(fimDoDia(agora).getTime() - 7 * DIA_MS) }, arquivadaEm: null },
        _count: { _all: true },
      }),
    ]);
    const mapa = (linhas: Array<{ responsavelId: string | null; _count: { _all: number } }>) =>
      new Map(linhas.map((l) => [l.responsavelId, l._count._all]));
    const [mAbertas, mVencidas, mFeitas] = [mapa(abertas), mapa(vencidas), mapa(feitas)];
    equipe = membros
      .filter((m) => m.podeEditar)
      .map((m) => ({
        id: m.id,
        nome: m.nome,
        imagem: m.imagem,
        abertas: mAbertas.get(m.id) ?? 0,
        atrasadas: mVencidas.get(m.id) ?? 0,
        concluidasSemana: mFeitas.get(m.id) ?? 0,
      }))
      .sort((a, b) => b.atrasadas - a.atrasadas || b.abertas - a.abertas || a.nome.localeCompare(b.nome));
  }

  return { minhas: { atrasadas, hoje, proximos7Dias, semPrazo, concluidasSemana }, equipe, semResponsavel };
}
