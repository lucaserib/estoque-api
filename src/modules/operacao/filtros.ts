import type { Prisma } from "@prisma/client";
import { fimDoDia, inicioDoDia } from "@/modules/financeiro/dominio/periodo";
import type { ContextoOperacao } from "./contexto";
import type { FiltrosTarefas } from "./dominio/esquemas";
import { intervaloDoDia } from "./dominio/prazo";

const DIA_MS = 24 * 60 * 60 * 1000;

export type FiltrosBasicos = Pick<FiltrosTarefas, "responsavelId" | "etiquetaId" | "prioridade" | "busca"> & {
  situacao?: FiltrosTarefas["situacao"];
  escopo?: FiltrosTarefas["escopo"];
  quadroId?: string;
  de?: string;
  ate?: string;
};

export function filtroDeSituacao(situacao: FiltrosTarefas["situacao"], agora: Date): Prisma.TarefaWhereInput {
  const abertas: Prisma.TarefaWhereInput = { concluidaEm: null, arquivadaEm: null };
  switch (situacao) {
    case "abertas":
      return abertas;
    case "atrasadas":
      return { ...abertas, prazo: { lt: agora } };
    case "hoje":
      return { ...abertas, prazo: { gte: agora, lte: fimDoDia(agora) } };
    case "semana":
      return { ...abertas, prazo: { gt: fimDoDia(agora), lte: fimDoDia(new Date(agora.getTime() + 7 * DIA_MS)) } };
    case "sem-prazo":
      return { ...abertas, prazo: null };
    case "concluidas":
      return { concluidaEm: { not: null }, arquivadaEm: null };
    case "arquivadas":
      return { arquivadaEm: { not: null } };
    case "todas":
      return { arquivadaEm: null };
  }
}

export function filtroDeBusca(busca: string | undefined): Prisma.TarefaWhereInput | null {
  const termo = busca?.trim();
  if (!termo) return null;
  const numero = /^#?(\d{1,9})$/.exec(termo);
  return {
    OR: [
      { titulo: { contains: termo, mode: "insensitive" } },
      { descricao: { contains: termo, mode: "insensitive" } },
      ...(numero ? [{ numero: Number(numero[1]) }] : []),
    ],
  };
}

export function montarFiltro(contexto: ContextoOperacao, filtros: FiltrosBasicos, agora: Date = new Date()): Prisma.TarefaWhereInput {
  const condicoes: Prisma.TarefaWhereInput[] = [{ contaId: contexto.contaId }];
  if (filtros.situacao !== "arquivadas") condicoes.push({ quadro: { arquivadoEm: null } });
  if (filtros.situacao) condicoes.push(filtroDeSituacao(filtros.situacao, agora));
  if (filtros.escopo === "minhas") condicoes.push({ responsavelId: contexto.userId });
  if (filtros.responsavelId === "eu") condicoes.push({ responsavelId: contexto.userId });
  else if (filtros.responsavelId === "ninguem") condicoes.push({ responsavelId: null });
  else if (filtros.responsavelId) condicoes.push({ responsavelId: filtros.responsavelId });
  if (filtros.etiquetaId) condicoes.push({ etiquetas: { some: { etiquetaId: filtros.etiquetaId } } });
  if (filtros.prioridade) condicoes.push({ prioridade: filtros.prioridade });
  if (filtros.quadroId) condicoes.push({ quadroId: filtros.quadroId });
  const busca = filtroDeBusca(filtros.busca);
  if (busca) condicoes.push(busca);
  const de = filtros.de ? intervaloDoDia(filtros.de) : null;
  const ate = filtros.ate ? intervaloDoDia(filtros.ate) : null;
  if (de || ate) {
    condicoes.push({ prazo: { ...(de ? { gte: inicioDoDia(de.inicio) } : {}), ...(ate ? { lte: ate.fim } : {}) } });
  }
  return { AND: condicoes };
}

export function ordenacao(ordem: FiltrosTarefas["ordem"]): Prisma.TarefaOrderByWithRelationInput[] {
  switch (ordem) {
    case "prazo":
      return [{ prazo: { sort: "asc", nulls: "last" } }, { prioridade: "desc" }, { numero: "asc" }];
    case "prioridade":
      return [{ prioridade: "desc" }, { prazo: { sort: "asc", nulls: "last" } }, { numero: "asc" }];
    case "criacao":
      return [{ createdAt: "desc" }];
    case "conclusao":
      return [{ concluidaEm: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }];
    case "atualizacao":
      return [{ updatedAt: "desc" }];
  }
}
