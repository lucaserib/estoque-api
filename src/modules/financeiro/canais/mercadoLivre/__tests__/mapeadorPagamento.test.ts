import { describe, it, expect } from "vitest";
import { mapearPagamento } from "../mapeadorPagamento";

describe("mapearPagamento", () => {
  it("Ciclo 9 (pedido 2000019043297364): tarifa 2.99, frete 6.85, retenção 12.14, líquido 12.72", () => {
    const resultado = mapearPagamento({
      id: 123456789,
      status: "approved",
      money_release_date: "2026-10-01T00:00:00.000Z",
      money_release_status: "released",
      transaction_details: { net_received_amount: 12.72 },
      charges_details: [
        { name: "mp_processing_fee", type: "fee", amounts: { original: 0.04 } },
        { name: "ml_sale_fee", type: "fee", amounts: { original: 0.71 } },
        { name: "mp_financing_fee", type: "fee", amounts: { original: 2.24 } },
        { name: "shp_fulfillment", type: "shipping", amounts: { original: 6.85 } },
        {
          name: "fee_spl",
          type: "fee",
          amounts: { original: 12.14 },
          metadata: { source: "direct-charges" },
          reserve_id: 987,
        },
      ],
    });

    expect(resultado.tarifaVenda).toBe(299);
    expect(resultado.freteVendedor).toBe(685);
    expect(resultado.retencaoDividas).toBe(1214);
    expect(resultado.valorLiquidoReceber).toBe(1272);
    expect(resultado.statusLiberacao).toBe("released");
    expect(resultado.desconhecidos).toEqual([]);
  });

  it("fee_spl é retenção mesmo sem metadata.source, por ter type 'fee' igual à tarifa", () => {
    const resultado = mapearPagamento({
      id: 1,
      charges_details: [{ name: "fee_spl", type: "fee", amounts: { original: 5 } }],
    });

    expect(resultado.retencaoDividas).toBe(500);
    expect(resultado.tarifaVenda).toBe(0);
  });

  it("mp_financing_* qualquer sufixo entra como tarifa", () => {
    const resultado = mapearPagamento({
      id: 2,
      charges_details: [{ name: "mp_financing_installments", type: "fee", amounts: { original: 1 } }],
    });

    expect(resultado.tarifaVenda).toBe(100);
  });

  it("cobrança desconhecida não é descartada: fica fora dos totais mas aparece em desconhecidos e cobrancas", () => {
    const resultado = mapearPagamento({
      id: 3,
      charges_details: [{ name: "algo_novo", type: "outro", amounts: { original: 9.99 } }],
    });

    expect(resultado.tarifaVenda).toBe(0);
    expect(resultado.freteVendedor).toBe(0);
    expect(resultado.retencaoDividas).toBe(0);
    expect(resultado.desconhecidos).toEqual(["algo_novo"]);
    expect(resultado.cobrancas).toHaveLength(1);
    expect(resultado.cobrancas[0].valor).toBe(999);
  });

  it("valor estornado reduz o líquido da cobrança, não só o bruto", () => {
    const resultado = mapearPagamento({
      id: 4,
      charges_details: [
        { name: "ml_sale_fee", type: "fee", amounts: { original: 10, refunded: 4 } },
      ],
    });

    expect(resultado.tarifaVenda).toBe(600);
    expect(resultado.cobrancas[0].valor).toBe(1000);
    expect(resultado.cobrancas[0].estornado).toBe(400);
  });

  it("sem charges_details e sem transaction_details: tudo zerado/null, nada inventado", () => {
    const resultado = mapearPagamento({ id: 5 });

    expect(resultado.tarifaVenda).toBe(0);
    expect(resultado.freteVendedor).toBe(0);
    expect(resultado.retencaoDividas).toBe(0);
    expect(resultado.valorLiquidoReceber).toBeNull();
    expect(resultado.dataLiberacao).toBeNull();
  });
});
