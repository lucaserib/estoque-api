import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/services/mercadoLivreService", () => ({
  MercadoLivreService: { getValidToken: vi.fn(async () => "token-falso") },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mercadoLivreAccount: {
      findUniqueOrThrow: vi.fn(async () => ({ mlUserId: "999" })),
    },
  },
}));

const { adaptadorMercadoLivre } = await import("../cliente");

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("listarCobrancas — F10 (Ciclo 8)", () => {
  it("pagina com sort_by=ID/order_by=ASC/from_id, usando o id do último resultado da página", async () => {
    const chamadas: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        chamadas.push(url);
        if (url.includes("document_type=BILL") && url.includes("from_id=0")) {
          return new Response(
            JSON.stringify({ results: Array.from({ length: 2 }, (_, i) => ({ id: i + 1, amount: 10, charge_type: "shipping_fee" })) }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({ results: [] }), { status: 200 });
      })
    );

    const resultado = await adaptadorMercadoLivre.listarCobrancas!(
      { contaCanalId: "conta-1", userId: "user-1" },
      "2026-05"
    );

    expect(resultado).toHaveLength(2);
    expect(chamadas.some((u) => u.includes("sort_by=ID") && u.includes("order_by=ASC"))).toBe(true);
    expect(chamadas.some((u) => u.includes("document_type=CREDIT_NOTE"))).toBe(true);
  });

  it("lê também CREDIT_NOTE, não só BILL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("document_type=CREDIT_NOTE")) {
          return new Response(
            JSON.stringify({ results: [{ id: 1, amount: 5, charge_type: "refund" }] }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({ results: [] }), { status: 200 });
      })
    );

    const resultado = await adaptadorMercadoLivre.listarCobrancas!(
      { contaCanalId: "conta-1", userId: "user-1" },
      "2026-05"
    );

    expect(resultado).toHaveLength(1);
  });

  it("falha na API devolve lista vazia sem derrubar a ingestão", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("erro", { status: 500 })));

    const resultado = await adaptadorMercadoLivre.listarCobrancas!(
      { contaCanalId: "conta-1", userId: "user-1" },
      "2026-05"
    );

    expect(resultado).toEqual([]);
  });
});
