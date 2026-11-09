import { z } from "zod";
import type { PapelColunaTarefa, PrioridadeTarefa } from "@prisma/client";
import { lerDia } from "./prazo";
import { recorrenciaSchema } from "./recorrencia";

export const CORES_OPERACAO = ["azul", "verde", "amarelo", "laranja", "vermelho", "roxo", "rosa", "cinza"] as const;
export type CorOperacao = (typeof CORES_OPERACAO)[number];

export const PRIORIDADES = ["BAIXA", "MEDIA", "ALTA", "URGENTE"] as const satisfies readonly PrioridadeTarefa[];
export const PAPEIS_COLUNA = ["A_FAZER", "EM_ANDAMENTO", "CONCLUIDA"] as const satisfies readonly PapelColunaTarefa[];

export const ROTULOS_PRIORIDADE: Record<PrioridadeTarefa, string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
  URGENTE: "Urgente",
};

export const PESO_PRIORIDADE: Record<PrioridadeTarefa, number> = { URGENTE: 0, ALTA: 1, MEDIA: 2, BAIXA: 3 };

export const ROTULOS_PAPEL_COLUNA: Record<PapelColunaTarefa, string> = {
  A_FAZER: "A fazer",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
};

export const LIMITES = {
  titulo: 200,
  descricao: 10_000,
  comentario: 4_000,
  textoChecklist: 300,
  itensChecklist: 100,
  nomeQuadro: 60,
  descricaoQuadro: 300,
  nomeColuna: 40,
  nomeEtiqueta: 30,
  colunasPorQuadro: 12,
  quadrosPorConta: 30,
  etiquetasPorConta: 60,
  etiquetasPorTarefa: 10,
  tituloNota: 120,
  conteudoNota: 5_000,
  notasPorConta: 2_000,
  busca: 100,
} as const;

export const COLUNAS_PADRAO: Array<{ nome: string; papel: PapelColunaTarefa }> = [
  { nome: "A fazer", papel: "A_FAZER" },
  { nome: "Fazendo", papel: "EM_ANDAMENTO" },
  { nome: "Aguardando", papel: "EM_ANDAMENTO" },
  { nome: "Feito", papel: "CONCLUIDA" },
];

export const ETIQUETAS_PADRAO: Array<{ nome: string; cor: CorOperacao }> = [
  { nome: "Compras", cor: "azul" },
  { nome: "Estoque", cor: "verde" },
  { nome: "Full", cor: "amarelo" },
  { nome: "Anúncios", cor: "laranja" },
  { nome: "Financeiro", cor: "roxo" },
  { nome: "Atendimento", cor: "rosa" },
  { nome: "Marketing", cor: "vermelho" },
  { nome: "Fiscal", cor: "cinza" },
];

export const NOME_QUADRO_PADRAO = "Operação da loja";

const id = z.string().trim().min(1).max(64);
const texto = (maximo: number, mensagem: string) => z.string().trim().min(1, mensagem).max(maximo);

export const corSchema = z.enum(CORES_OPERACAO);

export const prazoEntradaSchema = z
  .object({
    data: z.string().refine((valor) => lerDia(valor) !== null, "Data inválida."),
    hora: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida.")
      .nullable()
      .optional(),
  })
  .nullable();

export const vinculoSchema = z
  .object({
    tipo: z.enum(["PRODUTO", "ANUNCIO_ML", "PEDIDO_COMPRA", "FORNECEDOR", "TELA"]),
    id: z.string().trim().max(64).nullable().optional(),
    rotulo: texto(120, "Informe o nome do vínculo."),
    href: z
      .string()
      .trim()
      .max(300)
      .regex(/^\/(?!\/)[^\s\\]*$/, "O vínculo precisa ser uma tela do Skubo."),
  })
  .nullable();

export const ORIGENS_DO_CLIENTE = [
  "MANUAL",
  "CAPTURA_RAPIDA",
  "CENTRAL_CONTROLE",
  "REPOSICAO",
  "SAUDE_ANUNCIOS",
  "PRODUTO",
  "PEDIDO_COMPRA",
] as const;

export const criarTarefaSchema = z.object({
  titulo: texto(LIMITES.titulo, "Dê um título para a tarefa."),
  descricao: z.string().max(LIMITES.descricao).nullable().optional(),
  quadroId: id.optional(),
  colunaId: id.optional(),
  prioridade: z.enum(PRIORIDADES).optional(),
  responsavelId: id.nullable().optional(),
  prazo: prazoEntradaSchema.optional(),
  etiquetaIds: z.array(id).max(LIMITES.etiquetasPorTarefa).optional(),
  checklist: z.array(texto(LIMITES.textoChecklist, "Item vazio.")).max(30).optional(),
  recorrencia: recorrenciaSchema.nullable().optional(),
  origem: z.enum(ORIGENS_DO_CLIENTE).optional(),
  chaveOrigem: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9:_.-]{0,119}$/i, "Chave de origem inválida.")
    .optional(),
  vinculo: vinculoSchema.optional(),
  notaId: id.optional(),
});

export type EntradaCriarTarefa = z.infer<typeof criarTarefaSchema>;

export const atualizarTarefaSchema = z
  .object({
    titulo: texto(LIMITES.titulo, "Dê um título para a tarefa.").optional(),
    descricao: z.string().max(LIMITES.descricao).nullable().optional(),
    prioridade: z.enum(PRIORIDADES).optional(),
    responsavelId: id.nullable().optional(),
    prazo: prazoEntradaSchema.optional(),
    etiquetaIds: z.array(id).max(LIMITES.etiquetasPorTarefa).optional(),
    recorrencia: recorrenciaSchema.nullable().optional(),
    vinculo: vinculoSchema.optional(),
    versao: z.number().int().min(1).optional(),
  })
  .refine((valor) => Object.keys(valor).some((chave) => chave !== "versao"), "Nada para alterar.");

export type EntradaAtualizarTarefa = z.infer<typeof atualizarTarefaSchema>;

export const moverSchema = z.object({
  colunaId: id,
  anteriorId: id.nullable().optional(),
  seguinteId: id.nullable().optional(),
});

export const moverNaListaSchema = z.object({
  anteriorId: id.nullable().optional(),
  seguinteId: id.nullable().optional(),
});

export const acaoTarefaSchema = z.object({
  acao: z.enum(["concluir", "reabrir", "arquivar", "restaurar", "duplicar"]),
});

export const SITUACOES_FILTRO = ["abertas", "atrasadas", "hoje", "semana", "sem-prazo", "concluidas", "arquivadas", "todas"] as const;
export const ORDENS_FILTRO = ["prazo", "prioridade", "criacao", "conclusao", "atualizacao"] as const;

export const filtrosTarefasSchema = z.object({
  escopo: z.enum(["minhas", "equipe"]).default("equipe"),
  situacao: z.enum(SITUACOES_FILTRO).default("abertas"),
  responsavelId: id.optional(),
  etiquetaId: id.optional(),
  prioridade: z.enum(PRIORIDADES).optional(),
  quadroId: id.optional(),
  busca: z.string().trim().max(LIMITES.busca).optional(),
  de: z.string().refine((valor) => lerDia(valor) !== null, "Data inválida.").optional(),
  ate: z.string().refine((valor) => lerDia(valor) !== null, "Data inválida.").optional(),
  ordem: z.enum(ORDENS_FILTRO).default("prazo"),
  pagina: z.coerce.number().int().min(1).max(10_000).default(1),
  porPagina: z.coerce.number().int().min(1).max(200).default(50),
});

export type FiltrosTarefas = z.infer<typeof filtrosTarefasSchema>;

export const quadroSchema = z.object({
  nome: texto(LIMITES.nomeQuadro, "Dê um nome para o quadro."),
  descricao: z.string().trim().max(LIMITES.descricaoQuadro).nullable().optional(),
  cor: corSchema.default("azul"),
});

export const atualizarQuadroSchema = z
  .object({
    nome: texto(LIMITES.nomeQuadro, "Dê um nome para o quadro.").optional(),
    descricao: z.string().trim().max(LIMITES.descricaoQuadro).nullable().optional(),
    cor: corSchema.optional(),
    arquivado: z.boolean().optional(),
  })
  .refine((valor) => Object.keys(valor).length > 0, "Nada para alterar.");

export const colunaSchema = z.object({
  nome: texto(LIMITES.nomeColuna, "Dê um nome para a coluna."),
  papel: z.enum(PAPEIS_COLUNA).default("EM_ANDAMENTO"),
  limite: z.number().int().min(1).max(999).nullable().optional(),
});

export const atualizarColunaSchema = z
  .object({
    nome: texto(LIMITES.nomeColuna, "Dê um nome para a coluna.").optional(),
    papel: z.enum(PAPEIS_COLUNA).optional(),
    limite: z.number().int().min(1).max(999).nullable().optional(),
  })
  .refine((valor) => Object.keys(valor).length > 0, "Nada para alterar.");

export const apagarColunaSchema = z.object({ destinoId: id.nullable().optional() });

export const etiquetaSchema = z.object({
  nome: texto(LIMITES.nomeEtiqueta, "Dê um nome para a etiqueta."),
  cor: corSchema.default("azul"),
});

export const atualizarEtiquetaSchema = z
  .object({
    nome: texto(LIMITES.nomeEtiqueta, "Dê um nome para a etiqueta.").optional(),
    cor: corSchema.optional(),
  })
  .refine((valor) => Object.keys(valor).length > 0, "Nada para alterar.");

export const itemChecklistSchema = z.object({ texto: texto(LIMITES.textoChecklist, "Escreva o item.") });

export const atualizarItemChecklistSchema = z
  .object({
    texto: texto(LIMITES.textoChecklist, "Escreva o item.").optional(),
    concluido: z.boolean().optional(),
    anteriorId: id.nullable().optional(),
    seguinteId: id.nullable().optional(),
  })
  .refine((valor) => Object.keys(valor).length > 0, "Nada para alterar.");

export const comentarioSchema = z.object({ corpo: texto(LIMITES.comentario, "Escreva o comentário.") });

export const notaSchema = z.object({
  tipo: z.enum(["NOTA", "IDEIA"]).default("NOTA"),
  titulo: z.string().trim().max(LIMITES.tituloNota).nullable().optional(),
  conteudo: texto(LIMITES.conteudoNota, "Escreva a nota."),
  cor: corSchema.default("amarelo"),
  fixada: z.boolean().default(false),
  visibilidade: z.enum(["EQUIPE", "PRIVADA"]).default("EQUIPE"),
});

export const atualizarNotaSchema = z
  .object({
    tipo: z.enum(["NOTA", "IDEIA"]).optional(),
    titulo: z.string().trim().max(LIMITES.tituloNota).nullable().optional(),
    conteudo: texto(LIMITES.conteudoNota, "Escreva a nota.").optional(),
    cor: corSchema.optional(),
    fixada: z.boolean().optional(),
    visibilidade: z.enum(["EQUIPE", "PRIVADA"]).optional(),
    arquivada: z.boolean().optional(),
  })
  .refine((valor) => Object.keys(valor).length > 0, "Nada para alterar.");

export const filtrosNotasSchema = z.object({
  tipo: z.enum(["NOTA", "IDEIA", "TODAS"]).default("TODAS"),
  visibilidade: z.enum(["EQUIPE", "PRIVADA", "TODAS"]).default("TODAS"),
  arquivadas: z.preprocess((valor) => valor === true || valor === "1" || valor === "true", z.boolean()).default(false),
  busca: z.string().trim().max(LIMITES.busca).optional(),
});

export const filtrosQuadroSchema = z.object({
  responsavelId: id.optional(),
  etiquetaId: id.optional(),
  prioridade: z.enum(PRIORIDADES).optional(),
  busca: z.string().trim().max(LIMITES.busca).optional(),
  situacao: z.enum(["todas", "atrasadas", "hoje", "semana", "sem-prazo"]).default("todas"),
  mostrarConcluidas: z.preprocess((valor) => valor === true || valor === "1" || valor === "true", z.boolean()).default(false),
});
