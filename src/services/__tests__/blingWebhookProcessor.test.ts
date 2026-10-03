import { describe, it, expect } from "vitest";
import { extrairBlingProdutoId } from "@/services/blingWebhookProcessor";

describe("extrairBlingProdutoId", () => {
  it("lê o id direto de data para eventos product.*", () => {
    expect(extrairBlingProdutoId("product.updated", { id: 123 })).toBe("123");
    expect(extrairBlingProdutoId("product.created", { id: "456" })).toBe("456");
  });

  it("retorna null quando product.* não tem id", () => {
    expect(extrairBlingProdutoId("product.deleted", {})).toBeNull();
  });

  it("lê produto.id para eventos de estoque", () => {
    expect(
      extrairBlingProdutoId("stock.updated", { produto: { id: 789 }, depositos: [] })
    ).toBe("789");
    expect(
      extrairBlingProdutoId("virtual_stock.updated", { produto: { id: 321 } })
    ).toBe("321");
  });

  it("aceita idProduto ou produtoId como alternativa para eventos não-product", () => {
    expect(extrairBlingProdutoId("product_supplier.updated", { idProduto: 111 })).toBe(
      "111"
    );
    expect(extrairBlingProdutoId("product_supplier.created", { produtoId: 222 })).toBe(
      "222"
    );
  });

  it("retorna null quando nenhum campo conhecido está presente", () => {
    expect(extrairBlingProdutoId("stock.updated", { algoInesperado: true })).toBeNull();
  });
});
