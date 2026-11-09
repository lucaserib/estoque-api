import { prisma } from "@/lib/prisma";
import { textoSemMarcacao } from "./dominio/mencoes";
import type { ContextoOperacao } from "./contexto";
import { enviarEmailsDosAvisos } from "./emails";

export interface TarefaAviso {
  id: string;
  numero: number;
  titulo: string;
  responsavelId: string | null;
  criadoPorId: string | null;
}

export type TipoAvisoTarefa = "atribuida" | "mencao" | "comentario" | "concluida";

export interface AvisoEnviado {
  userId: string;
  tipo: TipoAvisoTarefa;
  tarefa: TarefaAviso;
  autorNome: string;
  trecho?: string;
}

export function linkDaTarefa(id: string): string {
  return `/operacao?tarefa=${id}`;
}

function resumir(texto: string, limite = 140): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  return limpo.length > limite ? `${limpo.slice(0, limite - 1)}…` : limpo;
}

function conteudoDoAviso(aviso: AvisoEnviado): { title: string; body: string } {
  const rotulo = `#${aviso.tarefa.numero} ${resumir(aviso.tarefa.titulo, 80)}`;
  switch (aviso.tipo) {
    case "atribuida":
      return { title: "Você recebeu uma tarefa", body: `${aviso.autorNome} passou para você: ${rotulo}` };
    case "mencao":
      return { title: `${aviso.autorNome} mencionou você`, body: `${rotulo}: “${aviso.trecho ?? ""}”` };
    case "comentario":
      return { title: "Novo comentário", body: `${aviso.autorNome} comentou em ${rotulo}: “${aviso.trecho ?? ""}”` };
    case "concluida":
      return { title: "Tarefa concluída", body: `${aviso.autorNome} concluiu ${rotulo}` };
  }
}

async function enviar(avisos: AvisoEnviado[]): Promise<void> {
  if (avisos.length === 0) return;
  try {
    await prisma.notification.createMany({
      data: avisos.map((aviso) => ({
        userId: aviso.userId,
        type: "TAREFA" as const,
        ...conteudoDoAviso(aviso),
        link: linkDaTarefa(aviso.tarefa.id),
      })),
    });
  } catch (error) {
    console.error("[OPERACAO] Falha ao gravar avisos:", error);
  }
  await enviarEmailsDosAvisos(avisos).catch((error) => console.error("[OPERACAO] Falha ao mandar e-mails dos avisos:", error));
}

export async function avisarAtribuicao(tarefa: TarefaAviso, autor: ContextoOperacao): Promise<void> {
  if (!tarefa.responsavelId || tarefa.responsavelId === autor.userId) return;
  await enviar([{ userId: tarefa.responsavelId, tipo: "atribuida", tarefa, autorNome: autor.nome }]);
}

export async function avisarComentario(
  tarefa: TarefaAviso,
  autor: ContextoOperacao,
  mencionados: string[],
  corpo: string
): Promise<void> {
  const trecho = resumir(textoSemMarcacao(corpo));
  const jaAvisados = new Set<string>([autor.userId]);
  const avisos: AvisoEnviado[] = [];
  for (const userId of mencionados) {
    if (jaAvisados.has(userId)) continue;
    jaAvisados.add(userId);
    avisos.push({ userId, tipo: "mencao", tarefa, autorNome: autor.nome, trecho });
  }
  for (const userId of [tarefa.responsavelId, tarefa.criadoPorId]) {
    if (!userId || jaAvisados.has(userId)) continue;
    jaAvisados.add(userId);
    avisos.push({ userId, tipo: "comentario", tarefa, autorNome: autor.nome, trecho });
  }
  await enviar(avisos);
}

export async function avisarConclusao(tarefa: TarefaAviso, autor: ContextoOperacao): Promise<void> {
  if (!tarefa.criadoPorId || tarefa.criadoPorId === autor.userId) return;
  await enviar([{ userId: tarefa.criadoPorId, tipo: "concluida", tarefa, autorNome: autor.nome }]);
}
