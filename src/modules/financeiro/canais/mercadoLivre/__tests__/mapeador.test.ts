import { describe, it, expect } from "vitest";
import { StatusVendaCanal } from "@prisma/client";
import type { MLOrder } from "@/types/mercadolivre";
import {
  mapearPedido,
  mapearStatus,
  mapearItem,
  somarDescontoVendedor,
  somarDescontoCusteadoPeloMl,
  mapearCustoEnvio,
  mapearEnvio,
} from "../mapeador";
import fixtureComum from "./fixtures/pedido-comum.json";
import fixtureDuasUnidades from "./fixtures/pedido-2-unidades.json";
import fixtureCancelado from "./fixtures/pedido-cancelado.json";

function pedidoBase(parcial: Partial<MLOrder> = {}): MLOrder {
  return {
    id: "1000001",
    status: "paid",
    date_created: "2026-05-10T14:00:00.000-04:00",
    date_closed: "2026-05-10T14:05:00.000-04:00",
    last_updated: "2026-05-10T14:05:00.000-04:00",
    order_items: [
      {
        item: { id: "MLB111", title: "Produto comum", seller_sku: "SKU-1" },
        quantity: 1,
        unit_price: 100,
        full_unit_price: 100,
        sale_fee: 12,
      },
    ],
    buyer: {},
    seller: {},
    currency_id: "BRL",
    shipping: { id: 555, logistic_type: "drop_off", cost: 20 },
    total_amount: 100,
    paid_amount: 100,
    payments: [
      { id: 1, status: "approved", transaction_amount: 100, money_release_date: "2026-05-25T00:00:00.000Z" },
    ],
    ...parcial,
  };
}

describe("mapearStatus", () => {
  it("pedido pago mapeia para PAGA", () => {
    expect(mapearStatus(pedidoBase({ status: "paid" }))).toBe(StatusVendaCanal.PAGA);
  });

  it("cancelado sem nenhum pagamento relevante não é ingerido (null)", () => {
    const pedido = pedidoBase({ status: "cancelled", paid_amount: undefined, payments: [] });
    expect(mapearStatus(pedido)).toBeNull();
  });

  it("F6 (Ciclo 8): cancelado depois de pago (paid_amount zerado pelo estorno) ainda é CANCELADA, pelo histórico de pagamentos", () => {
    const pedido = pedidoBase({
      status: "cancelled",
      paid_amount: 0,
      payments: [{ id: 1, status: "refunded", transaction_amount: 100, transaction_amount_refunded: 100 }],
    });
    expect(mapearStatus(pedido)).toBe(StatusVendaCanal.CANCELADA);
  });

  it("cancelado com pagamento aprovado e order_request.return mapeia para DEVOLVIDA", () => {
    const pedido = pedidoBase({
      status: "cancelled",
      paid_amount: 100,
      order_request: { return: "requested" },
    });
    expect(mapearStatus(pedido)).toBe(StatusVendaCanal.DEVOLVIDA);
  });

  it("F6 (Ciclo 8): pagamento parcialmente estornado mapeia para DEVOLVIDA_PARCIAL", () => {
    const pedido = pedidoBase({
      status: "cancelled",
      paid_amount: 50,
      payments: [{ id: 1, status: "partially_refunded", transaction_amount: 100, transaction_amount_refunded: 50 }],
    });
    expect(mapearStatus(pedido)).toBe(StatusVendaCanal.DEVOLVIDA_PARCIAL);
  });

  it("status ainda não relevante para o financeiro (aguardando pagamento) não é ingerido", () => {
    expect(mapearStatus(pedidoBase({ status: "payment_in_process", payments: [] }))).toBeNull();
  });
});

describe("mapearPedido — pedido pago simples", () => {
  it("mapeia campos do pedido e do item", () => {
    const normalizado = mapearPedido(pedidoBase(), { details: [] });

    expect(normalizado).not.toBeNull();
    expect(normalizado?.status).toBe(StatusVendaCanal.PAGA);
    expect(normalizado?.envioExternoId).toBe("555");
    expect(normalizado?.logistica).toBe("drop_off");
    expect(normalizado?.dataLiberacao?.toISOString()).toBe("2026-05-25T00:00:00.000Z");
    expect(normalizado?.itens).toHaveLength(1);
    expect(normalizado?.itens[0].precoUnitario).toBe(10000);
    expect(normalizado?.itens[0].tarifaTotal).toBe(1200);
    expect(normalizado?.itens[0].sku).toBe("SKU-1");
  });

  it("pedido fora de um pacote (pack_id ausente) mapeia pacoteExternoId como null", () => {
    const normalizado = mapearPedido(pedidoBase({ pack_id: null }), null);
    expect(normalizado?.pacoteExternoId).toBeNull();
  });
});

describe("mapearPedido — carrinho com pacote (pack_id) e frete único", () => {
  it("dois pedidos do mesmo carrinho compartilham pacoteExternoId e envioExternoId", () => {
    const pedidoA = mapearPedido(
      pedidoBase({ id: "2000001", pack_id: 9999, shipping: { id: 777, logistic_type: "drop_off" } }),
      null
    );
    const pedidoB = mapearPedido(
      pedidoBase({ id: "2000002", pack_id: 9999, shipping: { id: 777, logistic_type: "drop_off" } }),
      null
    );

    expect(pedidoA?.pacoteExternoId).toBe("9999");
    expect(pedidoB?.pacoteExternoId).toBe("9999");
    expect(pedidoA?.envioExternoId).toBe(pedidoB?.envioExternoId);
  });
});

describe("mapearPedido — cancelado", () => {
  it("preserva a data original da venda mesmo cancelado (abatido no mês da venda)", () => {
    const normalizado = mapearPedido(
      pedidoBase({ status: "cancelled", paid_amount: 100, last_updated: "2026-06-01T10:00:00.000Z" }),
      null
    );

    expect(normalizado?.status).toBe(StatusVendaCanal.CANCELADA);
    expect(normalizado?.dataVenda.toISOString()).toBe("2026-05-10T18:05:00.000Z");
    expect(normalizado?.dataCancelamento?.toISOString()).toBe("2026-06-01T10:00:00.000Z");
  });
});

describe("mapearPedido — devolvido", () => {
  it("mapeia para DEVOLVIDA quando há order_request.return", () => {
    const normalizado = mapearPedido(
      pedidoBase({ status: "cancelled", paid_amount: 100, order_request: { return: "approved" } }),
      null
    );

    expect(normalizado?.status).toBe(StatusVendaCanal.DEVOLVIDA);
  });
});

describe("mapearPedido — Full", () => {
  it("logistic_type fulfillment é preservado; frete do pedido continua vindo do shipping informado", () => {
    const normalizado = mapearPedido(
      pedidoBase({ shipping: { id: 888, logistic_type: "fulfillment" } }),
      null
    );

    expect(normalizado?.logistica).toBe("fulfillment");
  });
});

describe("mapearItem", () => {
  it("sale_fee é multiplicado pela quantidade (convenção já usada em sales-complete)", () => {
    const item = mapearItem({
      item: { id: "MLB1", title: "Produto", seller_sku: "A" },
      quantity: 3,
      unit_price: 50,
      sale_fee: 5,
    });

    expect(item.tarifaTotal).toBe(1500); // 5 * 3 * 100
  });

  it("prioriza seller_sku sobre seller_custom_field", () => {
    const item = mapearItem({
      item: { id: "MLB1", title: "Produto", seller_sku: "SKU-REAL", seller_custom_field: "SKU-ANTIGO" },
      quantity: 1,
      unit_price: 10,
    });

    expect(item.sku).toBe("SKU-REAL");
  });

  it("sem sale_fee informado, tarifaTotal é null (faltando, não zero)", () => {
    const item = mapearItem({
      item: { id: "MLB1", title: "Produto" },
      quantity: 1,
      unit_price: 10,
    });

    expect(item.tarifaTotal).toBeNull();
  });
});

describe("somarDescontoVendedor", () => {
  it("um detalhe com um item: soma só a parte do vendedor (amounts.seller)", () => {
    expect(
      somarDescontoVendedor({ details: [{ items: [{ amounts: { total: 10, seller: 4 } }] }] })
    ).toBe(400);
  });

  it("vários detalhes (campanha + cupom): soma a parte do vendedor de cada item", () => {
    expect(
      somarDescontoVendedor({
        details: [
          { items: [{ amounts: { total: 10, seller: 4 } }] },
          { items: [{ amounts: { total: 5, seller: 2 } }] },
        ],
      })
    ).toBe(600);
  });

  it("sem desconto: zero", () => {
    expect(somarDescontoVendedor(null)).toBe(0);
    expect(somarDescontoVendedor(undefined)).toBe(0);
    expect(somarDescontoVendedor({ details: [] })).toBe(0);
  });
});

describe("somarDescontoCusteadoPeloMl", () => {
  it("é a diferença entre total e seller — a parte que o ML bancou", () => {
    expect(
      somarDescontoCusteadoPeloMl(fixtureComum.descontos)
    ).toBe(100);
  });
});

describe("F1 (Ciclo 8) — id do pedido vem como número da API real", () => {
  it("pedidoExternoId é sempre string, mesmo quando a API devolve id numérico", () => {
    const pedido = fixtureComum.pedido as unknown as MLOrder;
    const normalizado = mapearPedido(pedido, fixtureComum.descontos);

    expect(typeof normalizado?.pedidoExternoId).toBe("string");
    expect(normalizado?.pedidoExternoId).toBe("2000019031090968");
  });

  it("envioExternoId também vem numérico no payload real e precisa virar string", () => {
    const pedido = fixtureComum.pedido as unknown as MLOrder;
    const normalizado = mapearPedido(pedido, fixtureComum.descontos);

    expect(normalizado?.envioExternoId).toBe("48282316083");
  });
});

describe("F5 (Ciclo 8) — formato real de /orders/{id}/discounts", () => {
  it("soma amounts.seller dos itens dentro de details, não um campo 'seller' no topo", () => {
    expect(somarDescontoVendedor(fixtureComum.descontos)).toBe(3430);
  });

  it("pedido de 2 unidades: desconto do vendedor é 68,60", () => {
    expect(somarDescontoVendedor(fixtureDuasUnidades.descontos)).toBe(6860);
  });
});

describe("F6 (Ciclo 8) — cancelamento depois do pagamento", () => {
  it("pedido cancelado com pagamento estornado (paid_amount zerado, payment refunded) ainda é CANCELADA", () => {
    const pedido = fixtureCancelado.pedido as unknown as MLOrder;

    expect(mapearStatus(pedido)).toBe(StatusVendaCanal.CANCELADA);
  });
});

describe("mapearEnvio — F8 (Ciclo 8)", () => {
  it("logistic_type confirmado via GET /shipments/{id}", () => {
    const resultado = mapearEnvio({ logistic_type: "self_service" });
    expect(resultado.logistica).toBe("self_service");
    expect(resultado.confianca).toBe("CONFIRMADO");
  });

  it("sem logistic_type: desconhecido (ESTIMADO)", () => {
    expect(mapearEnvio({}).logistica).toBeNull();
    expect(mapearEnvio({}).confianca).toBe("ESTIMADO");
  });
});

describe("mapearCustoEnvio", () => {
  it("subtrai compensations (lista) do custo do envio", () => {
    const resultado = mapearCustoEnvio({
      senders: [{ cost: 20, compensations: [{ amount: 5 }, { amount: 2 }] }],
    });

    expect(resultado.valor).toBe(1300); // (20 - 7) * 100
    expect(resultado.confianca).toBe("CONFIRMADO");
  });

  it("subtrai compensation (número único) quando não há lista", () => {
    const resultado = mapearCustoEnvio({ senders: [{ cost: 20, compensation: 5 }] });

    expect(resultado.valor).toBe(1500);
  });

  it("sem senders ou sem cost: valor desconhecido (ESTIMADO)", () => {
    expect(mapearCustoEnvio({}).valor).toBeNull();
    expect(mapearCustoEnvio({ senders: [] }).valor).toBeNull();
    expect(mapearCustoEnvio({}).confianca).toBe("ESTIMADO");
  });
});
