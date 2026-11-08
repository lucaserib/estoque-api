import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/modules/financeiro/relatorios/cache", () => ({ invalidarCacheFinanceiro: vi.fn() }));

const { mapearNotaFiscal, precisaDeDetalhe } = await import("../notasFiscais");

describe("mapearNotaFiscal", () => {
  it("lê valor da nota, frete e número do pedido da loja em centavos", () => {
    const nota = mapearNotaFiscal({
      id: 123456,
      numero: "001234",
      serie: "1",
      situacao: 5,
      dataEmissao: "2026-11-06 14:32:10",
      valorNota: 187.9,
      valorFrete: "23,40",
      numeroPedidoLoja: "2000011112222",
      chaveAcesso: "3526...",
    });

    expect(nota).toMatchObject({
      blingNotaId: "123456",
      numero: "001234",
      situacao: 5,
      valorNota: 18790,
      valorFrete: 2340,
      numeroPedidoLoja: "2000011112222",
    });
    expect(nota?.dataEmissao.toISOString()).toBe("2026-11-06T17:32:10.000Z");
  });

  it("aceita frete dentro de transporte quando não vem no topo", () => {
    const nota = mapearNotaFiscal({
      id: "9",
      situacao: "6",
      dataEmissao: "2026-11-06",
      valorNota: "50.00",
      transporte: { frete: 12.5 },
    });
    expect(nota?.valorFrete).toBe(1250);
    expect(nota?.numeroPedidoLoja).toBeNull();
  });

  it("descarta nota sem id, situação, data ou valor", () => {
    expect(mapearNotaFiscal({ situacao: 5, dataEmissao: "2026-11-06", valorNota: 10 })).toBeNull();
    expect(mapearNotaFiscal({ id: 1, dataEmissao: "2026-11-06", valorNota: 10 })).toBeNull();
    expect(mapearNotaFiscal({ id: 1, situacao: 5, valorNota: 10 })).toBeNull();
    expect(mapearNotaFiscal({ id: 1, situacao: 5, dataEmissao: "2026-11-06" })).toBeNull();
  });

  it("avisa com id e chaves recebidas e pula a nota quando valor, data ou pedido vêm fora do formato", () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(
      mapearNotaFiscal({
        id: 77,
        situacao: 5,
        dataEmissao: "ontem à tarde",
        valorNota: { total: 10 },
        numeroPedidoLoja: { numero: "123" },
        contato: { nome: "Maria", numeroDocumento: "12345678900" },
      })
    ).toBeNull();

    expect(aviso).toHaveBeenCalledTimes(1);
    const [, detalhe] = aviso.mock.calls[0] as [string, Record<string, unknown>];
    expect(detalhe).toEqual({
      notaId: "77",
      camposInvalidos: ["dataEmissao", "valorNota", "numeroPedidoLoja"],
      chavesRecebidas: ["contato", "dataEmissao", "id", "numeroPedidoLoja", "situacao", "valorNota"],
    });
    expect(JSON.stringify(aviso.mock.calls)).not.toContain("Maria");
    expect(JSON.stringify(aviso.mock.calls)).not.toContain("12345678900");
    aviso.mockRestore();
  });

  it("não avisa nem pula nota válida sem pedido da loja", () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(mapearNotaFiscal({ id: 5, situacao: 5, dataEmissao: "2026-11-06", valorNota: 10 })).not.toBeNull();
    expect(aviso).not.toHaveBeenCalled();
    aviso.mockRestore();
  });

  it("pede o detalhe quando a lista não traz valor ou pedido", () => {
    expect(precisaDeDetalhe({ id: 1, situacao: 5 })).toBe(true);
    expect(precisaDeDetalhe({ id: 1, situacao: 5, valorNota: 10, numeroPedidoLoja: null })).toBe(false);
  });
});
