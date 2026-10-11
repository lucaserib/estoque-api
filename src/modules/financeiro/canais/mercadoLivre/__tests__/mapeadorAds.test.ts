import { describe, it, expect } from "vitest";
import { mapearGastoAds } from "../mapeadorAds";

describe("mapearGastoAds", () => {
  it("mapeia custo, cliques e impressões convertendo reais para centavos", () => {
    const resultado = mapearGastoAds({
      id: "ad-1",
      campaign_id: "camp-1",
      item_id: "MLB123",
      metrics: { cost: 12.5, clicks: 10, prints: 200, direct_amount: 99.9, direct_items_quantity: 2 },
    });

    expect(resultado.custo).toBe(1250);
    expect(resultado.cliques).toBe(10);
    expect(resultado.impressoes).toBe(200);
    expect(resultado.receitaAtribuida).toBe(9990);
    expect(resultado.vendasAtribuidas).toBe(2);
    expect(resultado.anuncioExternoId).toBe("MLB123");
    expect(resultado.campanhaExternaId).toBe("camp-1");
  });

  it("sem métricas, custo vira zero e o resto fica null (não inventa dado)", () => {
    const resultado = mapearGastoAds({ id: "ad-2" });

    expect(resultado.custo).toBe(0);
    expect(resultado.cliques).toBeNull();
    expect(resultado.receitaAtribuida).toBeNull();
  });

  it("usa o id quando não há item_id", () => {
    const resultado = mapearGastoAds({ id: 999, metrics: { cost: 1 } });
    expect(resultado.anuncioExternoId).toBe("999");
  });
});
