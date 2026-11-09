import type {
  OrigemTarefa,
  PapelColunaTarefa,
  PrioridadeTarefa,
  TipoAtividadeTarefa,
  TipoNotaOperacao,
  TipoVinculoTarefa,
  UserRole,
  VisibilidadeNota,
} from "@prisma/client";
import type { CorOperacao } from "./dominio/esquemas";
import type { SituacaoPrazo } from "./dominio/prazo";
import type { Recorrencia } from "./dominio/recorrencia";

export interface PessoaResumo {
  id: string;
  nome: string;
  imagem: string | null;
}

export interface MembroDto extends PessoaResumo {
  email: string;
  papel: UserRole;
  podeEditar: boolean;
}

export interface EtiquetaDto {
  id: string;
  nome: string;
  cor: CorOperacao;
}

export interface VinculoDto {
  tipo: TipoVinculoTarefa;
  id: string | null;
  rotulo: string;
  href: string;
}

export interface CartaoTarefa {
  id: string;
  numero: number;
  titulo: string;
  prioridade: PrioridadeTarefa;
  posicao: number;
  quadroId: string;
  colunaId: string;
  responsavel: PessoaResumo | null;
  prazo: string | null;
  prazoData: string | null;
  prazoHora: string | null;
  situacao: SituacaoPrazo;
  concluidaEm: string | null;
  arquivadaEm: string | null;
  etiquetas: EtiquetaDto[];
  checklist: { total: number; feitos: number };
  comentarios: number;
  recorrente: boolean;
  vinculo: VinculoDto | null;
  origem: OrigemTarefa;
  atualizadaEm: string;
}

export interface ItemChecklistDto {
  id: string;
  texto: string;
  concluido: boolean;
  posicao: number;
  concluidoPor: PessoaResumo | null;
  concluidoEm: string | null;
}

export interface ComentarioDto {
  id: string;
  corpo: string;
  autor: PessoaResumo | null;
  criadoEm: string;
  editadoEm: string | null;
  podeEditar: boolean;
  podeApagar: boolean;
}

export interface AtividadeDto {
  id: string;
  tipo: TipoAtividadeTarefa;
  autor: PessoaResumo | null;
  dados: Record<string, unknown> | null;
  criadoEm: string;
}

export interface DetalheTarefa extends CartaoTarefa {
  descricao: string | null;
  versao: number;
  quadro: { id: string; nome: string };
  coluna: { id: string; nome: string; papel: PapelColunaTarefa };
  criadoPor: PessoaResumo | null;
  concluidaPor: PessoaResumo | null;
  criadaEm: string;
  recorrencia: Recorrencia | null;
  recorrenciaTexto: string | null;
  itensChecklist: ItemChecklistDto[];
  listaComentarios: ComentarioDto[];
  atividades: AtividadeDto[];
  notaOrigem: { id: string; titulo: string | null } | null;
}

export interface ColunaDto {
  id: string;
  nome: string;
  papel: PapelColunaTarefa;
  posicao: number;
  limite: number | null;
}

export interface ColunaComTarefas extends ColunaDto {
  tarefas: CartaoTarefa[];
  total: number;
  ocultas: number;
}

export interface QuadroDto {
  id: string;
  nome: string;
  descricao: string | null;
  cor: CorOperacao;
  padrao: boolean;
  arquivado: boolean;
  colunas: ColunaDto[];
}

export interface QuadroCompleto {
  quadro: QuadroDto;
  colunas: ColunaComTarefas[];
}

export interface PermissoesOperacao {
  podeEditar: boolean;
  podeAdministrar: boolean;
}

export interface InicioOperacao {
  usuario: PessoaResumo & PermissoesOperacao;
  quadros: QuadroDto[];
  etiquetas: EtiquetaDto[];
  membros: MembroDto[];
}

export interface PaginaTarefas {
  itens: CartaoTarefa[];
  total: number;
  pagina: number;
  porPagina: number;
}

export interface ResumoPessoa extends PessoaResumo {
  abertas: number;
  atrasadas: number;
  concluidasSemana: number;
}

export interface ResumoOperacao {
  minhas: { atrasadas: number; hoje: number; proximos7Dias: number; semPrazo: number; concluidasSemana: number };
  equipe: ResumoPessoa[] | null;
  semResponsavel: number;
}

export interface NotaDto {
  id: string;
  tipo: TipoNotaOperacao;
  titulo: string | null;
  conteudo: string;
  cor: CorOperacao;
  fixada: boolean;
  visibilidade: VisibilidadeNota;
  posicao: number;
  autor: PessoaResumo | null;
  apoios: number;
  apoiadaPorMim: boolean;
  tarefa: { id: string; numero: number; titulo: string } | null;
  arquivada: boolean;
  criadaEm: string;
  atualizadaEm: string;
  podeEditar: boolean;
}
