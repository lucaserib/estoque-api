import { prisma } from "@/lib/prisma";
import { type ContextoOperacao, exigirEdicao } from "./contexto";
import { LIMITES } from "./dominio/esquemas";
import { posicaoEntre, posicaoNoFim, posicoesRenumeradas } from "./dominio/posicao";
import { naoEncontrada, regraOperacao } from "./erros";
import { pessoa, pessoaSelect } from "./serializacao";
import { registrarAtividade } from "./tarefas";
import type { ItemChecklistDto } from "./tipos";

const itemSelect = {
  id: true,
  texto: true,
  concluido: true,
  posicao: true,
  concluidoEm: true,
  concluidoPor: { select: pessoaSelect },
} as const;

function itemDto(item: {
  id: string;
  texto: string;
  concluido: boolean;
  posicao: number;
  concluidoEm: Date | null;
  concluidoPor: { id: string; name: string | null; email: string; image: string | null } | null;
}): ItemChecklistDto {
  return {
    id: item.id,
    texto: item.texto,
    concluido: item.concluido,
    posicao: item.posicao,
    concluidoPor: pessoa(item.concluidoPor),
    concluidoEm: item.concluidoEm?.toISOString() ?? null,
  };
}

function resumir(texto: string): string {
  return texto.length > 80 ? `${texto.slice(0, 79)}…` : texto;
}

async function tarefaEditavel(contexto: ContextoOperacao, tarefaId: string): Promise<void> {
  const tarefa = await prisma.tarefa.findFirst({ where: { id: tarefaId, contaId: contexto.contaId }, select: { arquivadaEm: true } });
  if (!tarefa) throw naoEncontrada();
  if (tarefa.arquivadaEm) throw regraOperacao("Restaure a tarefa antes de mexer nela.");
}

async function itemDaConta(contexto: ContextoOperacao, id: string) {
  const item = await prisma.itemChecklistTarefa.findFirst({
    where: { id, tarefa: { contaId: contexto.contaId } },
    select: { id: true, tarefaId: true, texto: true, concluido: true, posicao: true },
  });
  if (!item) throw naoEncontrada("Item");
  return item;
}

export async function adicionarItem(contexto: ContextoOperacao, tarefaId: string, texto: string): Promise<ItemChecklistDto> {
  exigirEdicao(contexto);
  await tarefaEditavel(contexto, tarefaId);
  const total = await prisma.itemChecklistTarefa.count({ where: { tarefaId } });
  if (total >= LIMITES.itensChecklist) throw regraOperacao(`Uma tarefa pode ter até ${LIMITES.itensChecklist} itens.`);
  return prisma.$transaction(async (tx) => {
    const ultima = await tx.itemChecklistTarefa.aggregate({ where: { tarefaId }, _max: { posicao: true } });
    const item = await tx.itemChecklistTarefa.create({
      data: { tarefaId, texto, posicao: posicaoNoFim(ultima._max.posicao) },
      select: itemSelect,
    });
    await tx.tarefa.update({ where: { id: tarefaId }, data: { versao: { increment: 1 } } });
    await registrarAtividade(tx, tarefaId, contexto.userId, "CHECKLIST", { acao: "adicionou", texto: resumir(texto) });
    return itemDto(item);
  });
}

export async function atualizarItem(
  contexto: ContextoOperacao,
  id: string,
  dados: { texto?: string; concluido?: boolean; anteriorId?: string | null; seguinteId?: string | null }
): Promise<ItemChecklistDto> {
  exigirEdicao(contexto);
  const item = await itemDaConta(contexto, id);
  await tarefaEditavel(contexto, item.tarefaId);
  const reordenar = dados.anteriorId !== undefined || dados.seguinteId !== undefined;
  return prisma.$transaction(async (tx) => {
    let posicao: number | undefined;
    if (reordenar) {
      const irmaos = await tx.itemChecklistTarefa.findMany({
        where: { tarefaId: item.tarefaId, NOT: { id } },
        orderBy: { posicao: "asc" },
        select: { id: true, posicao: true },
      });
      const antes = irmaos.find((i) => i.id === dados.anteriorId)?.posicao ?? null;
      const depois = irmaos.find((i) => i.id === dados.seguinteId)?.posicao ?? null;
      const calculada = antes === null && depois === null ? posicaoNoFim(irmaos.at(-1)?.posicao) : posicaoEntre(antes, depois);
      if (calculada === null) {
        const indice = irmaos.findIndex((i) => i.id === dados.anteriorId);
        const ordem = [...irmaos.slice(0, indice + 1).map((i) => i.id), id, ...irmaos.slice(indice + 1).map((i) => i.id)];
        const novas = posicoesRenumeradas(ordem.length);
        for (const [i, itemId] of ordem.entries()) {
          if (itemId !== id) await tx.itemChecklistTarefa.update({ where: { id: itemId }, data: { posicao: novas[i] } });
        }
        posicao = novas[ordem.indexOf(id)];
      } else {
        posicao = calculada;
      }
    }
    const marcar = dados.concluido !== undefined && dados.concluido !== item.concluido;
    const atualizado = await tx.itemChecklistTarefa.update({
      where: { id },
      data: {
        ...(dados.texto !== undefined ? { texto: dados.texto } : {}),
        ...(posicao !== undefined ? { posicao } : {}),
        ...(marcar
          ? dados.concluido
            ? { concluido: true, concluidoEm: new Date(), concluidoPorId: contexto.userId }
            : { concluido: false, concluidoEm: null, concluidoPorId: null }
          : {}),
      },
      select: itemSelect,
    });
    await tx.tarefa.update({ where: { id: item.tarefaId }, data: { versao: { increment: 1 } } });
    if (marcar) {
      await registrarAtividade(tx, item.tarefaId, contexto.userId, "CHECKLIST", {
        acao: dados.concluido ? "marcou" : "desmarcou",
        texto: resumir(atualizado.texto),
      });
    }
    return itemDto(atualizado);
  });
}

export async function apagarItem(contexto: ContextoOperacao, id: string): Promise<void> {
  exigirEdicao(contexto);
  const item = await itemDaConta(contexto, id);
  await tarefaEditavel(contexto, item.tarefaId);
  await prisma.$transaction(async (tx) => {
    await tx.itemChecklistTarefa.delete({ where: { id } });
    await tx.tarefa.update({ where: { id: item.tarefaId }, data: { versao: { increment: 1 } } });
    await registrarAtividade(tx, item.tarefaId, contexto.userId, "CHECKLIST", { acao: "apagou", texto: resumir(item.texto) });
  });
}
