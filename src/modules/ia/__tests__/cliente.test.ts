import { describe, expect, it, vi } from "vitest";
import { APIConnectionTimeoutError, APIUserAbortError, InternalServerError, RateLimitError } from "@anthropic-ai/sdk";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { montarRequisicao, traduzirErroProvedor, lerJsonDaResposta } = await import("../cliente");
const { IaCanceladaError, IaIndisponivelError } = await import("../erros");

const base = {
  recurso: "CHAT" as const,
  modelo: "claude-sonnet-5-5",
  sistemaFixo: "fixo",
  sistemaVariavel: "hoje",
  mensagens: [{ role: "user" as const, content: "oi" }],
  maxTokens: 1000,
};

describe("montarRequisicao", () => {
  it("marca o sistema fixo e a última ferramenta para cache e deixa a parte variável depois", () => {
    const corpo = montarRequisicao(
      {
        ...base,
        ferramentas: [
          { name: "a", description: "A", input_schema: { type: "object" } },
          { name: "b", description: "B", input_schema: { type: "object" } },
        ],
        esforco: "low",
      },
      true
    );
    const sistema = corpo.system as Array<{ text: string; cache_control?: unknown }>;
    expect(sistema[0]).toMatchObject({ text: "fixo", cache_control: { type: "ephemeral" } });
    expect(sistema[1]).toEqual({ type: "text", text: "hoje" });
    expect(corpo.tools?.[0]).not.toHaveProperty("cache_control");
    expect(corpo.tools?.[1]).toMatchObject({ cache_control: { type: "ephemeral" }, eager_input_streaming: true });
    expect(corpo.output_config).toEqual({ effort: "low" });
    expect(corpo.tool_choice).toBeUndefined();
    expect(corpo.fallbacks).toBe("default");
  });

  it("usa tool_choice none para pedir resposta sem ferramentas e formato json_schema", () => {
    const corpo = montarRequisicao(
      {
        ...base,
        modelo: "claude-haiku-5-5",
        ferramentas: [{ name: "a", description: "A", input_schema: { type: "object" } }],
        semFerramentas: true,
        formato: { type: "object" },
      },
      false
    );
    expect(corpo.tool_choice).toEqual({ type: "none" });
    expect(corpo.output_config?.format).toEqual({ type: "json_schema", schema: { type: "object" } });
    expect(corpo.tools?.[0]).not.toHaveProperty("eager_input_streaming");
    expect(corpo.fallbacks).toBeUndefined();
    expect(corpo.betas).toBeUndefined();
  });
});

describe("traduzirErroProvedor", () => {
  it("transforma 429, 529/5xx e timeout em FALHA_PROVEDOR com mensagem amigável", () => {
    const erros = [
      new RateLimitError(429, undefined, "rate", new Headers()),
      new InternalServerError(529, undefined, "overloaded", new Headers()),
      new APIConnectionTimeoutError({ message: "timeout" }),
    ];
    const detalhes = erros.map((e) => {
      const traduzido = traduzirErroProvedor(e);
      expect(traduzido).toBeInstanceOf(IaIndisponivelError);
      expect((traduzido as InstanceType<typeof IaIndisponivelError>).codigo).toBe("FALHA_PROVEDOR");
      expect(traduzido.message).toBe("A IA está instável agora, tente em alguns minutos.");
      return (traduzido as InstanceType<typeof IaIndisponivelError>).detalhe;
    });
    expect(detalhes).toEqual(["HTTP_429", "HTTP_529", "TIMEOUT"]);
  });

  it("cancelamento do usuário vira IaCanceladaError", () => {
    expect(traduzirErroProvedor(new APIUserAbortError())).toBeInstanceOf(IaCanceladaError);
  });
});

describe("lerJsonDaResposta", () => {
  it("lê o JSON do texto e devolve null se não for JSON", () => {
    expect(lerJsonDaResposta<{ a: number }>({ content: [{ type: "text", text: '{"a":1}', citations: null }] as never })).toEqual({ a: 1 });
    expect(lerJsonDaResposta({ content: [{ type: "text", text: "oi", citations: null }] as never })).toBeNull();
  });
});
