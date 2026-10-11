import { describe, it, expect } from "vitest";
import { mapearCobranca } from "../mapeadorCobrancas";

describe("mapearCobranca", () => {
  it("mapeia tarifa de venda como TARIFA_VENDA, cobertura pelo pedido", () => {
    const resultado = mapearCobranca({
      id: "det-1",
      date: "2026-05-10T00:00:00.000Z",
      amount: 10.5,
      order_id: "1000001",
      charge_type: "marketplace_fee",
    });

    expect(resultado.tipoNormalizado).toBe("TARIFA_VENDA");
    expect(resultado.coberturaPedido).toBe(true);
    expect(resultado.valor).toBe(1050);
    expect(resultado.pedidoExternoId).toBe("1000001");
  });

  it("armazenagem Full não é coberta pelo pedido (vira linha própria da DRE)", () => {
    const resultado = mapearCobranca({ id: "det-2", amount: 50, charge_type: "fulfillment_fee" });

    expect(resultado.tipoNormalizado).toBe("ARMAZENAGEM_FULL");
    expect(resultado.coberturaPedido).toBe(false);
  });

  it("tipo desconhecido vira NAO_MAPEADO, com o valor preservado (nada se descarta)", () => {
    const resultado = mapearCobranca({ id: "det-3", amount: 7, charge_type: "um_tipo_novo_qualquer" });

    expect(resultado.tipoNormalizado).toBe("NAO_MAPEADO");
    expect(resultado.tipoExterno).toBe("um_tipo_novo_qualquer");
    expect(resultado.valor).toBe(700);
  });
});
