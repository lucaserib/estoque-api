import type Anthropic from "@anthropic-ai/sdk";
import { IaCanceladaError } from "./erros";
import type { MensagemParam, ParametrosIa, ProvedorIa, RespostaIa } from "./cliente";

type Bloco = Anthropic.Beta.Messages.BetaContentBlock;

const REGRAS_FERRAMENTA: Array<{ padrao: RegExp; nome: string; entrada: Record<string, unknown> }> = [
  { padrao: /compr|repos|acabar|ruptura|estoque/i, nome: "sugestao_reposicao", entrada: { urgencia: "todos", limite: 5 } },
  { padrao: /margem|fatur|lucro|financ|caiu|cresc/i, nome: "resumo_financeiro", entrada: { periodo: "mes_atual" } },
  { padrao: /an[uú]nci|perdendo venda|full/i, nome: "saude_anuncios", entrada: {} },
  { padrao: /cadastr|pend[eê]ncia|sem custo/i, nome: "pendencias_cadastro", entrada: {} },
];

function exemploDoEsquema(esquema: unknown): unknown {
  const s = (esquema ?? {}) as Record<string, unknown>;
  if (Array.isArray(s.enum) && s.enum.length > 0) return s.enum[0];
  if (s.type === "object") {
    const propriedades = (s.properties ?? {}) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(propriedades).map(([chave, valor]) => [chave, exemploDoEsquema(valor)]));
  }
  if (s.type === "array") {
    const quantidade = typeof s.minItems === "number" && s.minItems > 0 ? s.minItems : 3;
    return Array.from({ length: quantidade }, () => exemploDoEsquema(s.items));
  }
  if (s.type === "number" || s.type === "integer") return 1;
  if (s.type === "boolean") return true;
  return "Texto gerado pelo provedor de teste.";
}

function ultimaMensagem(mensagens: MensagemParam[]): MensagemParam | undefined {
  return mensagens[mensagens.length - 1];
}

function textoDaMensagem(mensagem: MensagemParam | undefined): string {
  if (!mensagem) return "";
  if (typeof mensagem.content === "string") return mensagem.content;
  return (mensagem.content ?? [])
    .map((bloco) => (bloco.type === "text" ? bloco.text : ""))
    .join(" ")
    .trim();
}

function resultadosDeFerramenta(mensagem: MensagemParam | undefined): string[] {
  if (!mensagem || typeof mensagem.content === "string") return [];
  return (mensagem.content ?? []).flatMap((bloco) => {
    if (bloco.type !== "tool_result") return [];
    if (typeof bloco.content === "string") return [bloco.content];
    return (bloco.content ?? []).map((parte) => (parte.type === "text" ? parte.text : ""));
  });
}

function montarResposta(parametros: ParametrosIa, content: Bloco[], stopReason: RespostaIa["stop_reason"]): RespostaIa {
  const textoEntrada = JSON.stringify(parametros.mensagens).length + parametros.sistemaFixo.length;
  return {
    id: `msg_falso_${Math.random().toString(36).slice(2, 10)}`,
    type: "message",
    role: "assistant",
    model: parametros.modelo,
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {
      input_tokens: Math.ceil(textoEntrada / 4),
      output_tokens: Math.ceil(JSON.stringify(content).length / 4),
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    },
  } as unknown as RespostaIa;
}

function blocoTexto(texto: string): Bloco {
  return { type: "text", text: texto, citations: null } as unknown as Bloco;
}

function responderChat(parametros: ParametrosIa): { content: Bloco[]; stop: RespostaIa["stop_reason"] } {
  const ultima = ultimaMensagem(parametros.mensagens);
  const resultados = resultadosDeFerramenta(ultima);
  const nomesDisponiveis = new Set((parametros.ferramentas ?? []).map((f) => f.name));

  if (resultados.length > 0 || parametros.semFerramentas || nomesDisponiveis.size === 0) {
    const fontes = [...new Set(resultados.map((r) => /"fonte":"([^"]+)"/.exec(r)?.[1]).filter(Boolean))];
    const onde = fontes.length > 0 ? fontes.join(" e ") : "Central de controle";
    const texto = [
      "**Resposta de teste do Skubo IA.**",
      "",
      `- Consultei os dados da loja em **${onde}**.`,
      "- Os números são lidos das mesmas telas que você usa no dia a dia.",
      "",
      `Confira em ${onde} ou abra a [Central de controle](/controle).`,
    ].join("\n");
    return { content: [blocoTexto(texto)], stop: "end_turn" };
  }

  const pergunta = textoDaMensagem(ultima);
  const regra = REGRAS_FERRAMENTA.find((r) => r.padrao.test(pergunta) && nomesDisponiveis.has(r.nome));
  const nome = regra?.nome ?? (nomesDisponiveis.has("diagnostico_loja") ? "diagnostico_loja" : [...nomesDisponiveis][0]);
  const entrada = regra?.entrada ?? {};
  return {
    content: [
      blocoTexto("Vou consultar os dados da loja.\n\n"),
      { type: "tool_use", id: `toolu_falso_${nome}`, name: nome, input: entrada } as unknown as Bloco,
    ],
    stop: "tool_use",
  };
}

function responder(parametros: ParametrosIa): { content: Bloco[]; stop: RespostaIa["stop_reason"] } {
  if (parametros.formato) {
    return { content: [blocoTexto(JSON.stringify(exemploDoEsquema(parametros.formato)))], stop: "end_turn" };
  }
  if (parametros.recurso === "TITULO") {
    const primeira = textoDaMensagem(parametros.mensagens[0]).split(/\s+/).slice(0, 5).join(" ");
    return { content: [blocoTexto(primeira ? `Sobre: ${primeira}` : "Conversa de teste")], stop: "end_turn" };
  }
  if (parametros.recurso === "CHAT") return responderChat(parametros);
  return { content: [blocoTexto("Explicação de teste: os números vêm das telas do Skubo.")], stop: "end_turn" };
}

function verificarCancelamento(sinal?: AbortSignal) {
  if (sinal?.aborted) throw new IaCanceladaError();
}

export function criarProvedorFalso(): ProvedorIa {
  return {
    async criarMensagem(parametros) {
      verificarCancelamento(parametros.sinal);
      const { content, stop } = responder(parametros);
      return montarResposta(parametros, content, stop);
    },

    async transmitirMensagem(parametros, aoTexto) {
      verificarCancelamento(parametros.sinal);
      const { content, stop } = responder(parametros);
      for (const bloco of content) {
        if (bloco.type !== "text") continue;
        for (let i = 0; i < bloco.text.length; i += 24) {
          verificarCancelamento(parametros.sinal);
          aoTexto(bloco.text.slice(i, i + 24));
          await new Promise((resolver) => setTimeout(resolver, 8));
        }
      }
      return montarResposta(parametros, content, stop);
    },
  };
}
