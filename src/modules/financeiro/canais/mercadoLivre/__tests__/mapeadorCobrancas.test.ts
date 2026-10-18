import { describe, it, expect } from "vitest";
import { mapearCobranca, classificarCobranca } from "../mapeadorCobrancas";

function linha(chargeInfo: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return {
    charge_info: {
      detail_id: 123,
      detail_amount: 10.5,
      detail_type: "CHARGE",
      detail_sub_type: "CV",
      transaction_detail: "Cargo por venta",
      creation_date_time: "2026-05-10T12:00:00.000-03:00",
      ...chargeInfo,
    },
    ...extra,
  };
}

describe("mapearCobranca — formato real de /billing/.../details", () => {
  it("CV com pedido é tarifa de venda coberta pelo pedido (só conciliação)", () => {
    const resultado = mapearCobranca(linha({}, { sales_info: [{ order_id: 2000019043297364 }] }))!;
    expect(resultado.detalheExternoId).toBe("BILL:123");
    expect(resultado.tipoNormalizado).toBe("TARIFA_VENDA");
    expect(resultado.coberturaPedido).toBe(true);
    expect(resultado.valor).toBe(1050);
    expect(resultado.pedidoExternoId).toBe("2000019043297364");
    expect(resultado.data.toISOString()).toBe("2026-05-10T15:00:00.000Z");
  });

  it("frete sem pedido (ex.: coleta do Full, devolução) entra na DRE", () => {
    const resultado = mapearCobranca(linha({ detail_sub_type: "CXD", concept_type: "SHIPPING" }))!;
    expect(resultado.tipoNormalizado).toBe("FRETE");
    expect(resultado.coberturaPedido).toBe(false);
  });

  it("PADS é publicidade e serviço do Full é armazenagem", () => {
    expect(mapearCobranca(linha({ detail_sub_type: "PADS" }))!.tipoNormalizado).toBe("PUBLICIDADE");
    expect(mapearCobranca(linha({ detail_sub_type: "CFCB", concept_type: "FULFILLMENT" }))!.tipoNormalizado).toBe(
      "ARMAZENAGEM_FULL"
    );
  });

  it("sub-tipo desconhecido usa o concept_type; sem nenhum dos dois vira NAO_MAPEADO com o valor preservado", () => {
    expect(classificarCobranca("XPTO", "FULFILLMENT")).toBe("ARMAZENAGEM_FULL");
    const resultado = mapearCobranca(linha({ detail_sub_type: "XPTO", detail_amount: 7 }))!;
    expect(resultado.tipoNormalizado).toBe("NAO_MAPEADO");
    expect(resultado.valor).toBe(700);
    expect(resultado.tipoExterno).toContain("XPTO");
  });

  it("bônus e nota de crédito entram negativos", () => {
    expect(mapearCobranca(linha({ detail_type: "BONUS", detail_sub_type: "BXD" }))!.valor).toBe(-1050);
    expect(mapearCobranca(linha({ detail_sub_type: "ZZZ" }), "CREDIT_NOTE")!.valor).toBe(-1050);
  });

  it("linha sem detail_id é recusada (nunca grava com id vazio)", () => {
    expect(mapearCobranca(linha({ detail_id: undefined }))).toBeNull();
  });
});
