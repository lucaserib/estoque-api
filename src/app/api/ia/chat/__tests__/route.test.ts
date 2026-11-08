import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { LeitorSse } from "@/lib/sse";

const verifyUser = vi.fn(async () => ({ id: "user-1", contaId: "conta-1", role: "ADMIN" }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser }));
const limitarPerguntas = vi.fn(async () => ({ allowed: true, remaining: 19, resetAt: Date.now() + 1000 }));
vi.mock("@/modules/ia/limite", () => ({ limitarPerguntas }));
const responderPergunta = vi.fn();
const gerarTituloConversa = vi.fn(async () => "Compras da semana");
vi.mock("@/modules/ia/assistente", () => ({ responderPergunta, gerarTituloConversa }));

const { POST } = await import("../route");

function pedido(corpo: unknown) {
  return new NextRequest("https://app.skubo.com.br/api/ia/chat", { method: "POST", body: JSON.stringify(corpo) });
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/ia/chat", () => {
  it("responde em SSE com os cabeçalhos certos e os eventos na ordem, mais o título da conversa nova", async () => {
    responderPergunta.mockImplementation(async ({ emitir }: { emitir: (e: Record<string, unknown>) => void }) => {
      emitir({ tipo: "conversa", id: "conv-1", nova: true });
      emitir({ tipo: "texto", delta: "Olá" });
      emitir({ tipo: "fim", mensagemId: "m1", consumo: { percentual: 3 } });
      return { conversaId: "conv-1", mensagemId: "m1", novaConversa: true, pergunta: "Oi", resposta: "Olá" };
    });
    const r = await POST(pedido({ mensagem: "Oi", paginaAtual: "/reposicao" }));
    expect(r.headers.get("content-type")).toContain("text/event-stream");
    expect(r.headers.get("cache-control")).toBe("no-cache, no-transform");
    expect(r.headers.get("x-accel-buffering")).toBe("no");

    const eventos = new LeitorSse().alimentar(await r.text());
    expect(eventos).toEqual([
      { evento: "conversa", dados: { id: "conv-1", nova: true } },
      { evento: "texto", dados: { delta: "Olá" } },
      { evento: "fim", dados: { mensagemId: "m1", consumo: { percentual: 3 } } },
      { evento: "titulo", dados: { conversaId: "conv-1", titulo: "Compras da semana" } },
    ]);
    expect(responderPergunta).toHaveBeenCalledWith(
      expect.objectContaining({ usuario: { id: "user-1", contaId: "conta-1", role: "ADMIN" }, paginaAtual: "/reposicao" })
    );
    expect(limitarPerguntas).toHaveBeenCalledWith("user-1");
  });

  it("valida a mensagem (vazia ou acima de 2000 caracteres)", async () => {
    expect((await POST(pedido({ mensagem: "   " }))).status).toBe(400);
    expect((await POST(pedido({ mensagem: "x".repeat(2001) }))).status).toBe(400);
    expect(responderPergunta).not.toHaveBeenCalled();
  });

  it("aplica o limite de 20 perguntas a cada 10 minutos por usuário", async () => {
    limitarPerguntas.mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 });
    const r = await POST(pedido({ mensagem: "Oi" }));
    expect(r.status).toBe(429);
    expect(responderPergunta).not.toHaveBeenCalled();
  });
});
