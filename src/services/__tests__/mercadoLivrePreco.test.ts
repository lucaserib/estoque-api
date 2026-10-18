import { describe, it, expect, vi, beforeEach } from "vitest";

const { obterPrecoAtualAnuncio } = await import("../mercadoLivrePreco");

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("obterPrecoAtualAnuncio", () => {
  it("usa sale_price quando disponível, sem promoção", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ amount: 100 }), { status: 200 }))
    );

    const resultado = await obterPrecoAtualAnuncio("MLB1", "token");

    expect(resultado).toEqual({
      precoAtual: 10000,
      precoOriginal: null,
      temPromocao: false,
      fonte: "SALE_PRICE",
    });
  });

  it("usa sale_price com regular_amount: detecta promoção", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ amount: 34.7, regular_amount: 45.7 }), { status: 200 }))
    );

    const resultado = await obterPrecoAtualAnuncio("MLB1", "token");

    expect(resultado).toEqual({
      precoAtual: 3470,
      precoOriginal: 4570,
      temPromocao: true,
      fonte: "SALE_PRICE",
    });
  });

  it("sale_price indisponível (404): cai para /prices com promoção", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("sale_price")) return new Response("não encontrado", { status: 404 });
      if (url.includes("/prices")) {
        return new Response(
          JSON.stringify({
            prices: [
              { type: "promotion", amount: 30, regular_amount: 50, conditions: { context_restrictions: ["channel_marketplace"] } },
            ],
          }),
          { status: 200 }
        );
      }
      throw new Error(`URL inesperada: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await obterPrecoAtualAnuncio("MLB1", "token");

    expect(resultado).toEqual({
      precoAtual: 3000,
      precoOriginal: 5000,
      temPromocao: true,
      fonte: "PRICES_FALLBACK",
    });
  });

  it("sale_price indisponível e sem promoção no fallback: usa o preço standard", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("sale_price")) return new Response("erro", { status: 500 });
      if (url.includes("/prices")) {
        return new Response(
          JSON.stringify({
            prices: [
              { type: "standard", amount: 40, conditions: { context_restrictions: ["channel_marketplace"] } },
            ],
          }),
          { status: 200 }
        );
      }
      throw new Error(`URL inesperada: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await obterPrecoAtualAnuncio("MLB1", "token");

    expect(resultado).toEqual({ precoAtual: 4000, precoOriginal: null, temPromocao: false, fonte: "PRICES_FALLBACK" });
  });

  it("nenhuma fonte responde: devolve null, sem inventar preço", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("erro", { status: 500 })));

    const resultado = await obterPrecoAtualAnuncio("MLB1", "token");

    expect(resultado).toBeNull();
  });

  it("erro de rede no sale_price ainda tenta o fallback", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("sale_price")) throw new Error("timeout");
      return new Response(
        JSON.stringify({
          prices: [{ type: "standard", amount: 20, conditions: { context_restrictions: ["channel_marketplace"] } }],
        }),
        { status: 200 }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await obterPrecoAtualAnuncio("MLB1", "token");

    expect(resultado?.precoAtual).toBe(2000);
    expect(resultado?.fonte).toBe("PRICES_FALLBACK");
  });
});
