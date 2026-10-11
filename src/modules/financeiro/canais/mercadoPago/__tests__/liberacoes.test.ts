import { describe, it, expect, vi, beforeEach } from "vitest";

const getValidTokenMock = vi.fn(async () => "token-falso");
vi.mock("@/services/mercadoLivreService", () => ({
  MercadoLivreService: { getValidToken: getValidTokenMock },
}));

let flagHabilitada = false;
vi.mock("@/lib/prisma", () => ({
  prisma: {
    configuracaoGeral: {
      findUnique: vi.fn(async () => ({ usarRelatorioLiberacaoMercadoPago: flagHabilitada })),
    },
  },
}));

const { conferirLiberacoes, lerRelatorioLiberacaoMercadoPago } = await import("../liberacoes");

beforeEach(() => {
  flagHabilitada = false;
  vi.unstubAllGlobals();
});

describe("conferirLiberacoes", () => {
  it("flag desligada: não chama a API, devolve habilitado=false", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await conferirLiberacoes("user-1", "conta-1", new Date(), new Date());

    expect(resultado.habilitado).toBe(false);
    expect(resultado.liberacoes).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("flag ligada: busca e normaliza o relatório", async () => {
    flagHabilitada = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ results: [{ source_id: "1000001", amount: 55.5, date: "2026-05-20T00:00:00.000Z" }] }),
          { status: 200 }
        )
      )
    );

    const resultado = await conferirLiberacoes("user-1", "conta-1", new Date(), new Date());

    expect(resultado.habilitado).toBe(true);
    expect(resultado.liberacoes).toEqual([
      { referenciaExterna: "1000001", valor: 5550, data: new Date("2026-05-20T00:00:00.000Z") },
    ]);
  });
});

describe("lerRelatorioLiberacaoMercadoPago", () => {
  it("falha da API devolve lista vazia em vez de quebrar", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("erro", { status: 500 })));

    const resultado = await lerRelatorioLiberacaoMercadoPago("conta-1", new Date(), new Date());

    expect(resultado).toEqual([]);
  });
});
