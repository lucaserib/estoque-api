import { describe, expect, it } from "vitest";
import { LeitorSse, formatarEventoSse, lerEventosSse } from "../sse";

describe("LeitorSse", () => {
  it("junta um evento quebrado em vários pedaços", () => {
    const leitor = new LeitorSse();
    const bruto = formatarEventoSse("texto", { delta: "Olá, mundo" });
    const meio = Math.floor(bruto.length / 2);
    expect(leitor.alimentar(bruto.slice(0, 5))).toEqual([]);
    expect(leitor.alimentar(bruto.slice(5, meio))).toEqual([]);
    expect(leitor.alimentar(bruto.slice(meio))).toEqual([{ evento: "texto", dados: { delta: "Olá, mundo" } }]);
  });

  it("entrega vários eventos que chegam no mesmo pedaço, com CRLF e comentários", () => {
    const leitor = new LeitorSse();
    const pedaco =
      formatarEventoSse("conversa", { id: "c1" }) +
      ": ping\n\n" +
      "event: texto\r\ndata: {\"delta\":\"a\"}\r\n\r\n" +
      formatarEventoSse("fim", { mensagemId: "m1" }) +
      "event: texto\ndata: {\"del";
    expect(leitor.alimentar(pedaco)).toEqual([
      { evento: "conversa", dados: { id: "c1" } },
      { evento: "texto", dados: { delta: "a" } },
      { evento: "fim", dados: { mensagemId: "m1" } },
    ]);
    expect(leitor.alimentar('ta":"b"}\n\n')).toEqual([{ evento: "texto", dados: { delta: "b" } }]);
  });

  it("junta várias linhas data e devolve texto cru quando não é JSON", () => {
    const leitor = new LeitorSse();
    expect(leitor.alimentar("data: linha 1\ndata: linha 2\n\n")).toEqual([{ evento: "message", dados: "linha 1\nlinha 2" }]);
    expect(leitor.alimentar("event: x\ndata: {\"a\":1}")).toEqual([]);
    expect(leitor.finalizar()).toEqual([{ evento: "x", dados: { a: 1 } }]);
  });
});

describe("lerEventosSse", () => {
  it("lê a resposta inteira mesmo com UTF-8 partido entre pedaços", async () => {
    const bytes = new TextEncoder().encode(formatarEventoSse("texto", { delta: "ação" }) + formatarEventoSse("fim", {}));
    const corpo = new ReadableStream<Uint8Array>({
      start(c) {
        for (let i = 0; i < bytes.length; i += 3) c.enqueue(bytes.slice(i, i + 3));
        c.close();
      },
    });
    const eventos: unknown[] = [];
    await lerEventosSse(new Response(corpo), (e) => eventos.push(e));
    expect(eventos).toEqual([
      { evento: "texto", dados: { delta: "ação" } },
      { evento: "fim", dados: {} },
    ]);
  });
});
