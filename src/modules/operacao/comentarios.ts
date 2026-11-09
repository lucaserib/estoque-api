import { prisma } from "@/lib/prisma";
import { type ContextoOperacao, exigirEdicao, idsDaConta } from "./contexto";
import { extrairMencoes, limparMencoesInvalidas } from "./dominio/mencoes";
import { naoEncontrada, semPermissaoOperacao } from "./erros";
import { avisarComentario } from "./avisos";
import { pessoa, pessoaSelect } from "./serializacao";
import { registrarAtividade } from "./tarefas";
import type { ComentarioDto } from "./tipos";

async function prepararCorpo(contexto: ContextoOperacao, corpoBruto: string): Promise<{ corpo: string; mencoes: string[] }> {
  const candidatos = extrairMencoes(corpoBruto);
  const validas = await idsDaConta(contexto.contaId, candidatos);
  const corpo = limparMencoesInvalidas(corpoBruto, validas);
  return { corpo, mencoes: extrairMencoes(corpo) };
}

function comentarioDto(
  contexto: ContextoOperacao,
  comentario: {
    id: string;
    corpo: string;
    autorId: string | null;
    createdAt: Date;
    editadoEm: Date | null;
    autor: { id: string; name: string | null; email: string; image: string | null } | null;
  }
): ComentarioDto {
  return {
    id: comentario.id,
    corpo: comentario.corpo,
    autor: pessoa(comentario.autor),
    criadoEm: comentario.createdAt.toISOString(),
    editadoEm: comentario.editadoEm?.toISOString() ?? null,
    podeEditar: contexto.podeEditar && comentario.autorId === contexto.userId,
    podeApagar: contexto.podeEditar && (comentario.autorId === contexto.userId || contexto.podeAdministrar),
  };
}

const comentarioSelect = {
  id: true,
  corpo: true,
  autorId: true,
  createdAt: true,
  editadoEm: true,
  autor: { select: pessoaSelect },
} as const;

export async function comentar(contexto: ContextoOperacao, tarefaId: string, corpoBruto: string): Promise<ComentarioDto> {
  exigirEdicao(contexto);
  const tarefa = await prisma.tarefa.findFirst({
    where: { id: tarefaId, contaId: contexto.contaId },
    select: { id: true, numero: true, titulo: true, responsavelId: true, criadoPorId: true },
  });
  if (!tarefa) throw naoEncontrada();
  const { corpo, mencoes } = await prepararCorpo(contexto, corpoBruto);
  const comentario = await prisma.$transaction(async (tx) => {
    const criado = await tx.comentarioTarefa.create({
      data: { tarefaId, autorId: contexto.userId, corpo, mencoes },
      select: comentarioSelect,
    });
    await registrarAtividade(tx, tarefaId, contexto.userId, "COMENTARIO", { comentarioId: criado.id });
    return criado;
  });
  await avisarComentario(tarefa, contexto, mencoes, corpo);
  return comentarioDto(contexto, comentario);
}

async function comentarioDaConta(contexto: ContextoOperacao, id: string) {
  const comentario = await prisma.comentarioTarefa.findFirst({
    where: { id, tarefa: { contaId: contexto.contaId } },
    select: { id: true, autorId: true, mencoes: true, tarefa: { select: { id: true, numero: true, titulo: true, responsavelId: true, criadoPorId: true } } },
  });
  if (!comentario) throw naoEncontrada("Comentário");
  return comentario;
}

export async function editarComentario(contexto: ContextoOperacao, id: string, corpoBruto: string): Promise<ComentarioDto> {
  exigirEdicao(contexto);
  const atual = await comentarioDaConta(contexto, id);
  if (atual.autorId !== contexto.userId) throw semPermissaoOperacao("Só quem escreveu pode editar o comentário.");
  const { corpo, mencoes } = await prepararCorpo(contexto, corpoBruto);
  const comentario = await prisma.comentarioTarefa.update({
    where: { id },
    data: { corpo, mencoes, editadoEm: new Date() },
    select: comentarioSelect,
  });
  const novas = mencoes.filter((m) => !atual.mencoes.includes(m));
  if (novas.length > 0) {
    await avisarComentario({ ...atual.tarefa, responsavelId: null, criadoPorId: null }, contexto, novas, corpo);
  }
  return comentarioDto(contexto, comentario);
}

export async function apagarComentario(contexto: ContextoOperacao, id: string): Promise<void> {
  exigirEdicao(contexto);
  const atual = await comentarioDaConta(contexto, id);
  if (atual.autorId !== contexto.userId && !contexto.podeAdministrar) {
    throw semPermissaoOperacao("Só quem escreveu ou o administrador pode apagar o comentário.");
  }
  await prisma.comentarioTarefa.delete({ where: { id } });
}
