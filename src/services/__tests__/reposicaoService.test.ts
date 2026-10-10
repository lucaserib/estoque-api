import { describe, it, expect } from "vitest";
import {
  calcularSugestaoReposicao,
  explodirDemandaKits,
  DadosProdutoReposicao,
} from "@/services/reposicaoService";

function dadosBase(
  overrides: Partial<DadosProdutoReposicao> = {}
): DadosProdutoReposicao {
  return {
    produtoId: "p1",
    nome: "Produto Teste",
    sku: "SKU1",
    custoMedio: 1000,
    vendas30Dias: 30,
    vendas31a90Dias: 60,
    estoqueLocal: 10,
    estoqueFullDisponivel: 0,
    estoqueFullEmTransito: 0,
    pedidosEmAbertoUnidades: 0,
    temAnuncioFull: false,
    fornecedorPrincipal: null,
    config: {
      avgDeliveryDays: 7,
      fullReleaseDays: 3,
      safetyStock: 10,
      minCoverageDays: 30,
    },
    ...overrides,
  };
}

describe("calcularSugestaoReposicao", () => {
  it("pedido em aberto reduz a quantidade sugerida", () => {
    const semPedido = calcularSugestaoReposicao(dadosBase());
    const comPedido = calcularSugestaoReposicao(
      dadosBase({ pedidosEmAbertoUnidades: 50 })
    );

    expect(semPedido.quantidadeSugeridaCompraUnidades).toBeGreaterThan(0);
    expect(comPedido.quantidadeSugeridaCompraUnidades).toBeLessThan(
      semPedido.quantidadeSugeridaCompraUnidades
    );
    expect(comPedido.estoqueDisponivel).toBe(
      semPedido.estoqueDisponivel + 50
    );
  });

  it("arredonda a sugestão para o múltiplo de caixa do fornecedor", () => {
    const resultado = calcularSugestaoReposicao(
      dadosBase({
        estoqueLocal: 0,
        fornecedorPrincipal: {
          fornecedorId: "f1",
          fornecedorNome: "Fornecedor X",
          prazoEntregaDias: 7,
          quantidadeMinima: null,
          multiplicador: 12,
        },
      })
    );

    expect(resultado.quantidadeSugeridaCompraUnidades % 12).toBe(0);
    expect(resultado.quantidadeSugeridaCompraUnidades).toBeGreaterThan(0);
  });

  it("respeita a quantidadeMinima do fornecedor mesmo quando a necessidade é menor", () => {
    const resultado = calcularSugestaoReposicao(
      dadosBase({
        vendas30Dias: 1,
        vendas31a90Dias: 1,
        estoqueLocal: 9,
        config: {
          avgDeliveryDays: 7,
          fullReleaseDays: 3,
          safetyStock: 10,
          minCoverageDays: 30,
        },
        fornecedorPrincipal: {
          fornecedorId: "f1",
          fornecedorNome: "Fornecedor X",
          prazoEntregaDias: 7,
          quantidadeMinima: 500,
          multiplicador: 1,
        },
      })
    );

    expect(resultado.quantidadeSugeridaCompraUnidades).toBe(500);
  });

  it("produto sem custo médio aparece com custoTotalCompra nulo", () => {
    const resultado = calcularSugestaoReposicao(
      dadosBase({ custoMedio: null, estoqueLocal: 0 })
    );

    expect(resultado.custoIndefinido).toBe(true);
    expect(resultado.custoTotalCompra).toBeNull();
    expect(resultado.quantidadeSugeridaCompraUnidades).toBeGreaterThan(0);
  });

  it("produto com custo médio calcula custoTotalCompra", () => {
    const resultado = calcularSugestaoReposicao(
      dadosBase({ custoMedio: 500, estoqueLocal: 0 })
    );

    expect(resultado.custoIndefinido).toBe(false);
    expect(resultado.custoTotalCompra).toBe(
      resultado.quantidadeSugeridaCompraUnidades * 500
    );
  });

  it("estoque bem acima do ponto de pedido não sugere compra", () => {
    const resultado = calcularSugestaoReposicao(
      dadosBase({ estoqueLocal: 10000 })
    );

    expect(resultado.quantidadeSugeridaCompraUnidades).toBe(0);
    expect(resultado.status).toBe("ok");
  });

  it("estoque zerado marca status crítico", () => {
    const resultado = calcularSugestaoReposicao(
      dadosBase({ estoqueLocal: 0, vendas30Dias: 0, vendas31a90Dias: 0 })
    );

    expect(resultado.status).toBe("critico");
  });

  it("lead time soma fullReleaseDays quando o produto vende pelo Full", () => {
    const semFull = calcularSugestaoReposicao(dadosBase({ temAnuncioFull: false }));
    const comFull = calcularSugestaoReposicao(dadosBase({ temAnuncioFull: true }));

    expect(comFull.leadTimeDias).toBe(semFull.leadTimeDias + 3);
  });

  it("sugere envio ao Full quando o Full está abaixo do necessário e há sobra local", () => {
    const resultado = calcularSugestaoReposicao(
      dadosBase({
        temAnuncioFull: true,
        estoqueLocal: 100,
        estoqueFullDisponivel: 0,
        estoqueFullEmTransito: 0,
      })
    );

    expect(resultado.quantidadeSugeridaEnvioFull).toBeGreaterThan(0);
  });

  it("não sugere envio ao Full quando não vende por lá", () => {
    const resultado = calcularSugestaoReposicao(
      dadosBase({ temAnuncioFull: false, estoqueLocal: 100 })
    );

    expect(resultado.quantidadeSugeridaEnvioFull).toBe(0);
  });
});

describe("explodirDemandaKits", () => {
  it("kit vendido gera demanda nos componentes", () => {
    const vendas = new Map([["kit-1", { v30: 10, v90: 20 }]]);
    const componentes = new Map([
      [
        "kit-1",
        [
          { produtoId: "componente-a", quantidade: 2 },
          { produtoId: "componente-b", quantidade: 1 },
        ],
      ],
    ]);

    const resultado = explodirDemandaKits(vendas, componentes);

    expect(resultado.get("componente-a")).toEqual({ v30: 20, v90: 40 });
    expect(resultado.get("componente-b")).toEqual({ v30: 10, v90: 20 });
    // a entrada do próprio kit permanece (pode ter estoque pré-montado)
    expect(resultado.get("kit-1")).toEqual({ v30: 10, v90: 20 });
  });

  it("soma a demanda explodida com a demanda direta já existente do componente", () => {
    const vendas = new Map([
      ["kit-1", { v30: 5, v90: 0 }],
      ["componente-a", { v30: 3, v90: 0 }],
    ]);
    const componentes = new Map([
      ["kit-1", [{ produtoId: "componente-a", quantidade: 1 }]],
    ]);

    const resultado = explodirDemandaKits(vendas, componentes);

    expect(resultado.get("componente-a")).toEqual({ v30: 8, v90: 0 });
  });

  it("produto sem kits associados não é alterado", () => {
    const vendas = new Map([["p1", { v30: 5, v90: 5 }]]);
    const resultado = explodirDemandaKits(vendas, new Map());

    expect(resultado.get("p1")).toEqual({ v30: 5, v90: 5 });
  });
});
