import type { Prisma } from "@prisma/client";
import { CORES_OPERACAO, type CorOperacao } from "./dominio/esquemas";
import { partesDoPrazo, situacaoDoPrazo } from "./dominio/prazo";
import { descreverRecorrencia, lerRecorrencia } from "./dominio/recorrencia";
import { nomeDaPessoa } from "./contexto";
import type { CartaoTarefa, ColunaDto, DetalheTarefa, EtiquetaDto, PessoaResumo, QuadroDto } from "./tipos";

const pessoaSelect = { id: true, name: true, email: true, image: true } satisfies Prisma.UserSelect;

export const cartaoSelect = {
  id: true,
  numero: true,
  titulo: true,
  prioridade: true,
  posicao: true,
  quadroId: true,
  colunaId: true,
  prazo: true,
  prazoComHora: true,
  concluidaEm: true,
  arquivadaEm: true,
  recorrencia: true,
  vinculoTipo: true,
  vinculoId: true,
  vinculoRotulo: true,
  vinculoHref: true,
  origem: true,
  updatedAt: true,
  responsavel: { select: pessoaSelect },
  etiquetas: { select: { etiqueta: { select: { id: true, nome: true, cor: true } } } },
  checklist: { select: { concluido: true } },
  _count: { select: { comentarios: true } },
} satisfies Prisma.TarefaSelect;

export type TarefaCartaoBanco = Prisma.TarefaGetPayload<{ select: typeof cartaoSelect }>;

export function pessoa(valor: { id: string; name: string | null; email: string; image: string | null } | null): PessoaResumo | null {
  if (!valor) return null;
  return { id: valor.id, nome: nomeDaPessoa(valor), imagem: valor.image };
}

export function cor(valor: string): CorOperacao {
  return (CORES_OPERACAO as readonly string[]).includes(valor) ? (valor as CorOperacao) : "azul";
}

export function etiquetaDto(etiqueta: { id: string; nome: string; cor: string }): EtiquetaDto {
  return { id: etiqueta.id, nome: etiqueta.nome, cor: cor(etiqueta.cor) };
}

export function serializarCartao(tarefa: TarefaCartaoBanco, agora: Date = new Date()): CartaoTarefa {
  const partes = tarefa.prazo ? partesDoPrazo(tarefa.prazo, tarefa.prazoComHora) : null;
  return {
    id: tarefa.id,
    numero: tarefa.numero,
    titulo: tarefa.titulo,
    prioridade: tarefa.prioridade,
    posicao: tarefa.posicao,
    quadroId: tarefa.quadroId,
    colunaId: tarefa.colunaId,
    responsavel: pessoa(tarefa.responsavel),
    prazo: tarefa.prazo?.toISOString() ?? null,
    prazoData: partes?.data ?? null,
    prazoHora: partes?.hora ?? null,
    situacao: situacaoDoPrazo(tarefa, agora),
    concluidaEm: tarefa.concluidaEm?.toISOString() ?? null,
    arquivadaEm: tarefa.arquivadaEm?.toISOString() ?? null,
    etiquetas: tarefa.etiquetas.map((e) => etiquetaDto(e.etiqueta)),
    checklist: { total: tarefa.checklist.length, feitos: tarefa.checklist.filter((i) => i.concluido).length },
    comentarios: tarefa._count.comentarios,
    recorrente: lerRecorrencia(tarefa.recorrencia) !== null,
    vinculo:
      tarefa.vinculoTipo && tarefa.vinculoRotulo && tarefa.vinculoHref
        ? { tipo: tarefa.vinculoTipo, id: tarefa.vinculoId, rotulo: tarefa.vinculoRotulo, href: tarefa.vinculoHref }
        : null,
    origem: tarefa.origem,
    atualizadaEm: tarefa.updatedAt.toISOString(),
  };
}

export const detalheCompletoSelect = {
  ...cartaoSelect,
  descricao: true,
  versao: true,
  createdAt: true,
  quadro: { select: { id: true, nome: true } },
  coluna: { select: { id: true, nome: true, papel: true } },
  criadoPor: { select: pessoaSelect },
  concluidaPor: { select: pessoaSelect },
  notas: { select: { id: true, titulo: true }, take: 1 },
} satisfies Prisma.TarefaSelect;

export type TarefaDetalheBanco = Prisma.TarefaGetPayload<{ select: typeof detalheCompletoSelect }>;

export function serializarDetalheBase(
  tarefa: TarefaDetalheBanco,
  agora: Date = new Date()
): Omit<DetalheTarefa, "itensChecklist" | "listaComentarios" | "atividades"> {
  const recorrencia = lerRecorrencia(tarefa.recorrencia);
  return {
    ...serializarCartao(tarefa, agora),
    descricao: tarefa.descricao,
    versao: tarefa.versao,
    quadro: tarefa.quadro,
    coluna: tarefa.coluna,
    criadoPor: pessoa(tarefa.criadoPor),
    concluidaPor: pessoa(tarefa.concluidaPor),
    criadaEm: tarefa.createdAt.toISOString(),
    recorrencia,
    recorrenciaTexto: recorrencia ? descreverRecorrencia(recorrencia) : null,
    notaOrigem: tarefa.notas[0] ? { id: tarefa.notas[0].id, titulo: tarefa.notas[0].titulo } : null,
  };
}

export function colunaDto(coluna: { id: string; nome: string; papel: ColunaDto["papel"]; posicao: number; limite: number | null }): ColunaDto {
  return { id: coluna.id, nome: coluna.nome, papel: coluna.papel, posicao: coluna.posicao, limite: coluna.limite };
}

export function quadroDto(quadro: {
  id: string;
  nome: string;
  descricao: string | null;
  cor: string;
  padrao: boolean;
  arquivadoEm: Date | null;
  colunas: Array<{ id: string; nome: string; papel: ColunaDto["papel"]; posicao: number; limite: number | null }>;
}): QuadroDto {
  return {
    id: quadro.id,
    nome: quadro.nome,
    descricao: quadro.descricao,
    cor: cor(quadro.cor),
    padrao: quadro.padrao,
    arquivado: quadro.arquivadoEm !== null,
    colunas: [...quadro.colunas].sort((a, b) => a.posicao - b.posicao).map(colunaDto),
  };
}

export { pessoaSelect };
