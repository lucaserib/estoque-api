import { PapelMensagemIa, type Prisma, RecursoIa, type UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { garantirAcessoIa, obterAcessoIa } from "./acesso";
import {
  type BlocoConteudoParam,
  type MensagemParam,
  type ProvedorIa,
  type RespostaIa,
  type ResultadoFerramentaParam,
  obterProvedorIa,
  textoDaResposta,
} from "./cliente";
import { ESFORCO, modeloPrincipal, modeloRapido } from "./config";
import { IaCanceladaError, IaIndisponivelError } from "./erros";
import {
  definicoesParaApi,
  executarFerramenta,
  ferramentasDoPapel,
  montarContextoFerramenta,
  rotuloDaFerramenta,
} from "./ferramentas/registro";
import {
  AVISO_LIMITE_CONSULTAS,
  PROMPT_ASSISTENTE,
  PROMPT_RESUMO_HISTORICO,
  PROMPT_TITULO,
  RESPOSTA_RECUSA,
  montarContextoDaSessao,
} from "./prompts/assistente";
import { type ConsumoIa, registrarUsoIa } from "./uso";

export const MAX_ITERACOES = 6;
const LIMITE_HISTORICO = 20;
const LIMITE_TOKENS_HISTORICO = 40_000;
const MENSAGENS_RECENTES_MANTIDAS = 6;
const MAX_TOKENS_CHAT = 8000;

export type EventoAssistente =
  | { tipo: "conversa"; id: string; nova: boolean }
  | { tipo: "texto"; delta: string }
  | { tipo: "ferramenta"; id: string; nome: string; rotulo: string; estado: "inicio" | "fim" | "erro" }
  | { tipo: "fim"; mensagemId: string; consumo: ConsumoIa }
  | { tipo: "titulo"; conversaId: string; titulo: string }
  | { tipo: "erro"; codigo: string; mensagem: string; conversaDescartada?: boolean };

export interface UsuarioAssistente {
  id: string;
  contaId: string;
  role: UserRole;
}

export interface ParametrosPergunta {
  usuario: UsuarioAssistente;
  conversaId?: string | null;
  mensagem: string;
  paginaAtual?: string | null;
  sinal?: AbortSignal;
  emitir: (evento: EventoAssistente) => void;
  provedor?: ProvedorIa;
  agora?: Date;
}

export interface ResultadoPergunta {
  conversaId: string | null;
  mensagemId: string | null;
  novaConversa: boolean;
  pergunta: string;
  resposta: string;
}

export interface RegistroFerramentaMensagem {
  nome: string;
  entrada: unknown;
  duracaoMs: number;
  erro: boolean;
}

export function tituloProvisorio(pergunta: string): string {
  const limpo = pergunta.replace(/\s+/g, " ").trim();
  return limpo.length > 60 ? `${limpo.slice(0, 57).trimEnd()}…` : limpo;
}

function estimarTokens(texto: string): number {
  return Math.ceil(texto.length / 4);
}

async function chamarModeloRapido(
  provedor: ProvedorIa,
  usuario: UsuarioAssistente,
  recurso: RecursoIa,
  sistema: string,
  conteudo: string,
  maxTokens: number
): Promise<string | null> {
  const modelo = modeloRapido();
  const inicio = Date.now();
  try {
    const resposta = await provedor.criarMensagem({
      recurso,
      modelo,
      sistemaFixo: sistema,
      mensagens: [{ role: "user", content: conteudo }],
      maxTokens,
      esforco: ESFORCO.rapido,
    });
    await registrarUsoIa({
      contaId: usuario.contaId,
      autorId: usuario.id,
      recurso,
      modelo,
      uso: resposta.usage,
      duracaoMs: Date.now() - inicio,
      sucesso: true,
    });
    return textoDaResposta(resposta).trim() || null;
  } catch (error) {
    await registrarUsoIa({
      contaId: usuario.contaId,
      autorId: usuario.id,
      recurso,
      modelo,
      uso: null,
      duracaoMs: Date.now() - inicio,
      sucesso: false,
      codigoErro: error instanceof IaIndisponivelError ? error.detalhe ?? error.codigo : "ERRO_INTERNO",
    });
    return null;
  }
}

async function montarHistorico(
  conversaId: string,
  usuario: UsuarioAssistente,
  provedor: ProvedorIa
): Promise<MensagemParam[]> {
  const recentes = (
    await prisma.mensagemIa.findMany({
      where: { conversaId },
      orderBy: { createdAt: "desc" },
      take: LIMITE_HISTORICO,
      select: { papel: true, conteudo: true },
    })
  )
    .reverse()
    .filter((m) => m.conteudo.trim().length > 0);

  const comoParam = (m: { papel: PapelMensagemIa; conteudo: string }): MensagemParam => ({
    role: m.papel === PapelMensagemIa.USUARIO ? "user" : "assistant",
    content: m.conteudo,
  });

  const total = recentes.reduce((t, m) => t + estimarTokens(m.conteudo), 0);
  if (total <= LIMITE_TOKENS_HISTORICO || recentes.length <= MENSAGENS_RECENTES_MANTIDAS) {
    return recentes.map(comoParam);
  }

  const antigas = recentes.slice(0, -MENSAGENS_RECENTES_MANTIDAS);
  const mantidas = recentes.slice(-MENSAGENS_RECENTES_MANTIDAS);
  const transcricao = antigas
    .map((m) => `${m.papel === PapelMensagemIa.USUARIO ? "Lojista" : "Assistente"}: ${m.conteudo}`)
    .join("\n\n")
    .slice(-120_000);
  const resumo = await chamarModeloRapido(provedor, usuario, RecursoIa.CHAT, PROMPT_RESUMO_HISTORICO, transcricao, 2000);
  const inicio: MensagemParam[] = resumo
    ? [{ role: "user", content: `Resumo das mensagens anteriores desta conversa:\n${resumo}` }]
    : [];
  return [...inicio, ...mantidas.map(comoParam)];
}

async function nomeDaLoja(contaId: string): Promise<string | null> {
  const dono = await prisma.user.findUnique({ where: { id: contaId }, select: { name: true } });
  return dono?.name ?? null;
}

function blocosDaResposta(resposta: RespostaIa): BlocoConteudoParam[] {
  return resposta.content as unknown as BlocoConteudoParam[];
}

export async function responderPergunta(parametros: ParametrosPergunta): Promise<ResultadoPergunta> {
  const { usuario, emitir, sinal } = parametros;
  const provedor = parametros.provedor ?? obterProvedorIa();
  const agora = parametros.agora ?? new Date();
  const modelo = modeloPrincipal();
  const pergunta = parametros.mensagem.trim();

  let conversaId: string | null = null;
  let novaConversa = false;
  let mensagemUsuarioId: string | null = null;
  let textoFinal = "";
  const registroFerramentas: RegistroFerramentaMensagem[] = [];

  const emitirTexto = (delta: string) => {
    textoFinal += delta;
    emitir({ tipo: "texto", delta });
  };
  const separar = () => {
    if (textoFinal && !textoFinal.endsWith("\n\n")) emitirTexto(textoFinal.endsWith("\n") ? "\n" : "\n\n");
  };

  const salvarResposta = async (conteudo: string) => {
    const salva = await prisma.mensagemIa.create({
      data: {
        conversaId: conversaId!,
        papel: PapelMensagemIa.ASSISTENTE,
        conteudo,
        ferramentas:
          registroFerramentas.length > 0 ? (registroFerramentas as unknown as Prisma.InputJsonValue) : undefined,
        modelo,
      },
      select: { id: true },
    });
    await prisma.conversaIa.update({ where: { id: conversaId! }, data: { updatedAt: new Date() } });
    return salva.id;
  };

  try {
    await garantirAcessoIa(usuario.contaId, agora);

    if (parametros.conversaId) {
      const existente = await prisma.conversaIa.findFirst({
        where: { id: parametros.conversaId, autorId: usuario.id, userId: usuario.contaId, arquivadaEm: null },
        select: { id: true },
      });
      if (!existente) {
        emitir({ tipo: "erro", codigo: "CONVERSA_NAO_ENCONTRADA", mensagem: "Essa conversa não existe mais. Comece uma nova." });
        return { conversaId: null, mensagemId: null, novaConversa: false, pergunta, resposta: "" };
      }
      conversaId = existente.id;
    } else {
      const criada = await prisma.conversaIa.create({
        data: { userId: usuario.contaId, autorId: usuario.id, titulo: tituloProvisorio(pergunta) },
        select: { id: true },
      });
      conversaId = criada.id;
      novaConversa = true;
    }
    emitir({ tipo: "conversa", id: conversaId, nova: novaConversa });

    const [historico, loja] = await Promise.all([montarHistorico(conversaId, usuario, provedor), nomeDaLoja(usuario.contaId)]);
    mensagemUsuarioId = (
      await prisma.mensagemIa.create({
        data: { conversaId, papel: PapelMensagemIa.USUARIO, conteudo: pergunta },
        select: { id: true },
      })
    ).id;

    const mensagens: MensagemParam[] = [...historico, { role: "user", content: pergunta }];
    const definicoes = ferramentasDoPapel(usuario.role);
    const ferramentas = definicoesParaApi(definicoes);
    const contexto = montarContextoFerramenta(usuario, agora);
    const sistemaVariavel = montarContextoDaSessao({
      agora,
      nomeDaLoja: loja,
      papel: usuario.role,
      paginaAtual: parametros.paginaAtual,
    });

    for (let iteracao = 0; iteracao <= MAX_ITERACOES; iteracao++) {
      const ultimaChance = iteracao === MAX_ITERACOES;
      const inicio = Date.now();
      let resposta: RespostaIa;
      try {
        resposta = await provedor.transmitirMensagem(
          {
            recurso: RecursoIa.CHAT,
            modelo,
            sistemaFixo: PROMPT_ASSISTENTE,
            sistemaVariavel,
            mensagens,
            ferramentas,
            semFerramentas: ultimaChance,
            maxTokens: MAX_TOKENS_CHAT,
            esforco: ESFORCO.chat,
            sinal,
          },
          emitirTexto
        );
      } catch (error) {
        await registrarUsoIa({
          contaId: usuario.contaId,
          autorId: usuario.id,
          recurso: RecursoIa.CHAT,
          modelo,
          uso: null,
          duracaoMs: Date.now() - inicio,
          sucesso: false,
          codigoErro:
            error instanceof IaCanceladaError
              ? "CANCELADO"
              : error instanceof IaIndisponivelError
              ? error.detalhe ?? error.codigo
              : "ERRO_INTERNO",
        });
        throw error;
      }

      await registrarUsoIa({
        contaId: usuario.contaId,
        autorId: usuario.id,
        recurso: RecursoIa.CHAT,
        modelo,
        uso: resposta.usage,
        duracaoMs: Date.now() - inicio,
        sucesso: true,
      });

      if (resposta.stop_reason === "refusal") {
        separar();
        emitirTexto(RESPOSTA_RECUSA);
        break;
      }

      const usos = resposta.content.filter(
        (bloco): bloco is Extract<RespostaIa["content"][number], { type: "tool_use" }> => bloco.type === "tool_use"
      );
      if (usos.length === 0 || ultimaChance || resposta.stop_reason === "max_tokens") break;

      mensagens.push({ role: "assistant", content: blocosDaResposta(resposta) });
      separar();

      const resultados: ResultadoFerramentaParam[] = await Promise.all(
        usos.map(async (uso) => {
          emitir({ tipo: "ferramenta", id: uso.id, nome: uso.name, rotulo: rotuloDaFerramenta(uso.name), estado: "inicio" });
          const r = await executarFerramenta(uso.name, uso.input, contexto);
          registroFerramentas.push({ nome: r.nome, entrada: r.entrada, duracaoMs: r.duracaoMs, erro: r.erro });
          emitir({ tipo: "ferramenta", id: uso.id, nome: uso.name, rotulo: r.rotulo, estado: r.erro ? "erro" : "fim" });
          return {
            type: "tool_result" as const,
            tool_use_id: uso.id,
            content: r.conteudo,
            ...(r.erro ? { is_error: true } : {}),
          };
        })
      );

      if (sinal?.aborted) throw new IaCanceladaError();

      mensagens.push({
        role: "user",
        content: [
          ...resultados,
          ...(iteracao === MAX_ITERACOES - 1 ? [{ type: "text" as const, text: AVISO_LIMITE_CONSULTAS }] : []),
        ],
      });
    }

    if (!textoFinal.trim()) emitirTexto("Não consegui montar uma resposta agora. Tente perguntar de outro jeito.");
    const mensagemId = await salvarResposta(textoFinal.trim());
    const { consumo } = await obterAcessoIa(usuario.contaId);
    emitir({ tipo: "fim", mensagemId, consumo });
    return { conversaId, mensagemId, novaConversa, pergunta, resposta: textoFinal.trim() };
  } catch (error) {
    const cancelado = error instanceof IaCanceladaError || Boolean(sinal?.aborted);
    if (conversaId && textoFinal.trim()) {
      const aviso = cancelado ? "\n\n_(resposta interrompida)_" : "\n\n_(a resposta não terminou: a IA ficou instável)_";
      const mensagemId = await salvarResposta(`${textoFinal.trim()}${aviso}`).catch(() => null);
      if (!cancelado) {
        emitir({ tipo: "erro", codigo: "FALHA_PROVEDOR", mensagem: "A IA está instável agora, tente em alguns minutos." });
      }
      return { conversaId, mensagemId, novaConversa, pergunta, resposta: textoFinal.trim() };
    }

    if (mensagemUsuarioId) await prisma.mensagemIa.delete({ where: { id: mensagemUsuarioId } }).catch(() => null);
    if (novaConversa && conversaId) await prisma.conversaIa.delete({ where: { id: conversaId } }).catch(() => null);

    if (!cancelado) {
      if (error instanceof IaIndisponivelError) {
        emitir({ tipo: "erro", codigo: error.codigo, mensagem: error.message, conversaDescartada: novaConversa });
      } else {
        console.error("[IA_CHAT] Falha ao responder", {
          conta: usuario.contaId,
          conversa: conversaId,
          erro: error instanceof Error ? error.name : "desconhecido",
        });
        emitir({
          tipo: "erro",
          codigo: "ERRO_INTERNO",
          mensagem: "Não consegui responder agora. Tente de novo em instantes.",
          conversaDescartada: novaConversa,
        });
      }
    }
    return { conversaId: novaConversa ? null : conversaId, mensagemId: null, novaConversa, pergunta, resposta: "" };
  }
}

export async function gerarTituloConversa(
  usuario: UsuarioAssistente,
  conversaId: string,
  pergunta: string,
  resposta: string,
  provedor: ProvedorIa = obterProvedorIa()
): Promise<string | null> {
  const bruto = await chamarModeloRapido(
    provedor,
    usuario,
    RecursoIa.TITULO,
    PROMPT_TITULO,
    `Pergunta: ${pergunta.slice(0, 600)}\n\nInício da resposta: ${resposta.slice(0, 600)}`,
    1000
  );
  const titulo = bruto
    ?.split("\n")[0]
    .replace(/^["'“”*#\s]+|["'“”*.\s]+$/g, "")
    .slice(0, 80)
    .trim();
  if (!titulo) return null;
  await prisma.conversaIa.updateMany({ where: { id: conversaId, autorId: usuario.id }, data: { titulo } });
  return titulo;
}
