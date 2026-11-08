import Anthropic, {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
  AuthenticationError,
  BadRequestError,
  PermissionDeniedError,
  RateLimitError,
} from "@anthropic-ai/sdk";
import type { RecursoIa } from "@prisma/client";
import { type EsforcoIa, usarProvedorFalso, workspaceAnthropic } from "./config";
import { IaCanceladaError, IaIndisponivelError, MENSAGEM_FALHA_PROVEDOR } from "./erros";
import { criarProvedorFalso } from "./provedorFalso";

export type MensagemParam = Anthropic.Beta.Messages.BetaMessageParam;
export type RespostaIa = Anthropic.Beta.Messages.BetaMessage;
export type FerramentaIa = Anthropic.Beta.Messages.BetaTool;
export type BlocoResposta = Anthropic.Beta.Messages.BetaContentBlock;
export type ResultadoFerramentaParam = Anthropic.Beta.Messages.BetaToolResultBlockParam;
export type BlocoConteudoParam = Anthropic.Beta.Messages.BetaContentBlockParam;
type CorpoRequisicao = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;

export interface ParametrosIa {
  recurso: RecursoIa;
  modelo: string;
  sistemaFixo: string;
  sistemaVariavel?: string;
  mensagens: MensagemParam[];
  ferramentas?: FerramentaIa[];
  semFerramentas?: boolean;
  maxTokens: number;
  esforco?: EsforcoIa;
  formato?: Record<string, unknown>;
  sinal?: AbortSignal;
}

export interface ProvedorIa {
  criarMensagem(parametros: ParametrosIa): Promise<RespostaIa>;
  transmitirMensagem(parametros: ParametrosIa, aoTexto: (delta: string) => void): Promise<RespostaIa>;
}

const MODELOS_COM_FALLBACK = new Set(["claude-sonnet-5-5", "claude-opus-5-5", "claude-opus-5", "claude-fable-5-1"]);

export function montarRequisicao(parametros: ParametrosIa, transmitindo: boolean): CorpoRequisicao {
  const ferramentas = (parametros.ferramentas ?? []).map((ferramenta, indice, lista) => ({
    ...ferramenta,
    ...(transmitindo ? { eager_input_streaming: true } : {}),
    ...(indice === lista.length - 1 ? { cache_control: { type: "ephemeral" as const } } : {}),
  }));

  const corpo: CorpoRequisicao = {
    model: parametros.modelo,
    max_tokens: parametros.maxTokens,
    system: [
      { type: "text", text: parametros.sistemaFixo, cache_control: { type: "ephemeral" } },
      ...(parametros.sistemaVariavel ? [{ type: "text" as const, text: parametros.sistemaVariavel }] : []),
    ],
    messages: parametros.mensagens,
    cache_control: { type: "ephemeral" },
    output_config: {
      ...(parametros.esforco ? { effort: parametros.esforco } : {}),
      ...(parametros.formato ? { format: { type: "json_schema" as const, schema: parametros.formato } } : {}),
    },
  };

  if (ferramentas.length > 0) {
    corpo.tools = ferramentas;
    if (parametros.semFerramentas) corpo.tool_choice = { type: "none" };
  }

  if (MODELOS_COM_FALLBACK.has(parametros.modelo)) {
    corpo.betas = ["server-side-fallback-2026-07-01"];
    corpo.fallbacks = "default";
  }

  return corpo;
}

export function traduzirErroProvedor(error: unknown): Error {
  if (error instanceof IaIndisponivelError || error instanceof IaCanceladaError) return error;
  if (error instanceof APIUserAbortError) return new IaCanceladaError();
  if (error instanceof RateLimitError) return new IaIndisponivelError(MENSAGEM_FALHA_PROVEDOR, "FALHA_PROVEDOR", "HTTP_429");
  if (error instanceof AuthenticationError || error instanceof PermissionDeniedError || error instanceof BadRequestError) {
    const credencial = !(error instanceof BadRequestError);
    console.error("[IA_PROVEDOR] Anthropic recusou a chamada", {
      status: error.status,
      tipo: credencial ? "credencial" : "requisicao",
      requestId: error.requestID ?? null,
      mensagem: error.message.slice(0, 300),
    });
    return new IaIndisponivelError(
      MENSAGEM_FALHA_PROVEDOR,
      "FALHA_PROVEDOR",
      credencial ? "CREDENCIAL" : "REQUISICAO_INVALIDA",
      error.message.slice(0, 300)
    );
  }
  if (error instanceof APIConnectionTimeoutError) {
    return new IaIndisponivelError(MENSAGEM_FALHA_PROVEDOR, "FALHA_PROVEDOR", "TIMEOUT");
  }
  if (error instanceof APIConnectionError) {
    return new IaIndisponivelError(MENSAGEM_FALHA_PROVEDOR, "FALHA_PROVEDOR", "CONEXAO");
  }
  if (error instanceof APIError) {
    return new IaIndisponivelError(
      MENSAGEM_FALHA_PROVEDOR,
      "FALHA_PROVEDOR",
      `HTTP_${error.status ?? "?"}`,
      error.message.slice(0, 300)
    );
  }
  return error instanceof Error ? error : new Error(String(error));
}

let clienteUnico: Anthropic | null = null;

function obterCliente(): Anthropic {
  if (!clienteUnico) {
    const workspace = workspaceAnthropic();
    clienteUnico = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY?.trim(),
      timeout: 60_000,
      maxRetries: 2,
      ...(workspace ? { defaultHeaders: { "anthropic-workspace-id": workspace } } : {}),
    });
  }
  return clienteUnico;
}

const provedorAnthropic: ProvedorIa = {
  async criarMensagem(parametros) {
    try {
      return await obterCliente().beta.messages.create(montarRequisicao(parametros, false), {
        signal: parametros.sinal,
      });
    } catch (error) {
      throw traduzirErroProvedor(error);
    }
  },

  async transmitirMensagem(parametros, aoTexto) {
    try {
      const fluxo = obterCliente().beta.messages.stream(montarRequisicao(parametros, true), {
        signal: parametros.sinal,
      });
      fluxo.on("text", (delta) => aoTexto(delta));
      return await fluxo.finalMessage();
    } catch (error) {
      throw traduzirErroProvedor(error);
    }
  },
};

export function obterProvedorIa(): ProvedorIa {
  return usarProvedorFalso() ? criarProvedorFalso() : provedorAnthropic;
}

export function textoDaResposta(resposta: Pick<RespostaIa, "content">): string {
  return resposta.content
    .filter((bloco): bloco is Anthropic.Beta.Messages.BetaTextBlock => bloco.type === "text")
    .map((bloco) => bloco.text)
    .join("");
}

export function lerJsonDaResposta<T>(resposta: Pick<RespostaIa, "content">): T | null {
  const texto = textoDaResposta(resposta).trim();
  if (!texto) return null;
  try {
    return JSON.parse(texto) as T;
  } catch {
    return null;
  }
}
