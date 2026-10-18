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

function linhaFatura(id: number, subTipo: string, valor: number, pedido?: number) {
  return {
    charge_info: {
      detail_id: id,
      detail_amount: valor,
      detail_type: "CHARGE",
      detail_sub_type: subTipo,
      transaction_detail: "Cobrança",
      creation_date_time: "2026-05-10T12:00:00.000-03:00",
    },
    sales_info: pedido ? [{ order_id: pedido }] : [],
    items_info: [],
  };
}

describe("listarCobrancas — formato real da fatura (Ciclo 10)", () => {
  it("pagina por offset até o total e lê BILL e CREDIT_NOTE do ML e do Full", async () => {
    const chamadas: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        chamadas.push(url);
        if (url.includes("/group/ML/details") && url.includes("document_type=BILL")) {
          const offset = Number(new URL(url).searchParams.get("offset"));
          const pagina =
            offset === 0
              ? Array.from({ length: 1000 }, (_, i) => linhaFatura(i + 1, "CV", 1, 10 + i))
              : [linhaFatura(5000, "PADS", 25)];
          return new Response(JSON.stringify({ total: 1001, results: pagina }), { status: 200 });
        }
        if (url.includes("/full/details")) return new Response(JSON.stringify({ total: 0, results: [] }), { status: 200 });
        return new Response(JSON.stringify({ total: 0, results: [] }), { status: 200 });
      })
    );

    const resultado = await adaptadorMercadoLivre.listarCobrancas!({ contaCanalId: "conta-1", userId: "user-1" }, "2026-05");

    expect(resultado).toHaveLength(1001);
    expect(chamadas.some((u) => u.includes("offset=1000"))).toBe(true);
    expect(chamadas.some((u) => u.includes("document_type=CREDIT_NOTE"))).toBe(true);
    expect(chamadas.some((u) => u.includes("/group/ML/full/details"))).toBe(true);
    const ads = resultado.find((c) => c.tipoNormalizado === "PUBLICIDADE")!;
    expect(ads.valor).toBe(2500);
    expect(ads.coberturaPedido).toBe(false);
    expect(resultado.find((c) => c.tipoNormalizado === "TARIFA_VENDA")!.coberturaPedido).toBe(true);
  });

  it("erro na fatura principal é propagado (a tarefa registra o erro em vez de gravar zero)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("erro", { status: 500 })));
    await expect(
      adaptadorMercadoLivre.listarCobrancas!({ contaCanalId: "conta-1", userId: "user-1" }, "2026-05")
    ).rejects.toThrow("HTTP 500");
  });
});
