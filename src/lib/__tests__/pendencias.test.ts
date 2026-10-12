import { describe, it, expect } from "vitest";
import {
  calcularPendencias,
  ProdutoParaPendencias,
} from "@/lib/pendencias";

function produtoBase(
  overrides: Partial<ProdutoParaPendencias> = {}
): ProdutoParaPendencias {
  return {
    isKit: false,
    custoMedio: 1000,
    precoVenda: 2000,
    ean: 7891234567895n,
    componentes: [],
    fornecedores: [{ principal: true, prazoEntregaDias: 7 }],
    produtosMercadoLivre: [],
    estoqueDivergente: false,
    vendaIncompleta: false,
    ...overrides,
  };
}

function codigosDe(produto: ProdutoParaPendencias): string[] {
  return calcularPendencias(produto).map((p) => p.codigo);
}

describe("calcularPendencias", () => {
  it("produto completo não gera nenhuma pendência", () => {
    const produto = produtoBase({
      produtosMercadoLivre: [
        {
          mlStatus: "active",
          mlPrice: 2000,
          mlCustoFrete: 100,
          mlTarifaVenda: 200,
          mlCustosAtualizadosEm: new Date(),
          mlFreeShipping: true,
        },
      ],
    });

    expect(calcularPendencias(produto)).toEqual([]);
  });

  it("SEM_CUSTO: produto simples sem custoMedio", () => {
    expect(codigosDe(produtoBase({ custoMedio: null }))).toContain(
      "SEM_CUSTO"
    );
  });

  it("SEM_CUSTO: kit com componente sem custo", () => {
    const produto = produtoBase({
      isKit: true,
      componentes: [
        { produto: { custoMedio: 100 } },
        { produto: { custoMedio: null } },
      ],
    });
    expect(codigosDe(produto)).toContain("SEM_CUSTO");
  });

  it("kit com todos componentes com custo não gera SEM_CUSTO", () => {
    const produto = produtoBase({
      isKit: true,
      custoMedio: null,
      componentes: [
        { produto: { custoMedio: 100 } },
        { produto: { custoMedio: 200 } },
      ],
    });
    expect(codigosDe(produto)).not.toContain("SEM_CUSTO");
  });

  it("SEM_FORNECEDOR: nenhum fornecedor cadastrado", () => {
    expect(codigosDe(produtoBase({ fornecedores: [] }))).toContain(
      "SEM_FORNECEDOR"
    );
  });

  it("SEM_FORNECEDOR_PRINCIPAL: tem fornecedor mas nenhum principal", () => {
    const produto = produtoBase({
      fornecedores: [{ principal: false, prazoEntregaDias: 5 }],
    });
    const codigos = codigosDe(produto);
    expect(codigos).toContain("SEM_FORNECEDOR_PRINCIPAL");
    expect(codigos).not.toContain("SEM_FORNECEDOR");
  });

  it("SEM_PRECO: sem precoVenda e sem anúncio ativo com preço", () => {
    expect(codigosDe(produtoBase({ precoVenda: null }))).toContain(
      "SEM_PRECO"
    );
  });

  it("anúncio ativo com preço supre a falta de precoVenda local", () => {
    const produto = produtoBase({
      precoVenda: null,
      produtosMercadoLivre: [
        {
          mlStatus: "active",
          mlPrice: 1500,
          mlCustoFrete: 0,
          mlTarifaVenda: 100,
          mlCustosAtualizadosEm: new Date(),
          mlFreeShipping: false,
        },
      ],
    });
    expect(codigosDe(produto)).not.toContain("SEM_PRECO");
  });

  it("SEM_FRETE: anúncio com frete grátis e mlCustoFrete nulo", () => {
    const produto = produtoBase({
      produtosMercadoLivre: [
        {
          mlStatus: "active",
          mlPrice: 2000,
          mlCustoFrete: null,
          mlTarifaVenda: 200,
          mlCustosAtualizadosEm: new Date(),
          mlFreeShipping: true,
        },
      ],
    });
    expect(codigosDe(produto)).toContain("SEM_FRETE");
  });

  it("SEM_FRETE: custo de frete desatualizado há mais de 7 dias", () => {
    const oitoDiasAtras = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const produto = produtoBase({
      produtosMercadoLivre: [
        {
          mlStatus: "active",
          mlPrice: 2000,
          mlCustoFrete: 100,
          mlTarifaVenda: 200,
          mlCustosAtualizadosEm: oitoDiasAtras,
          mlFreeShipping: true,
        },
      ],
    });
    expect(codigosDe(produto)).toContain("SEM_FRETE");
  });

  it("anúncio sem frete grátis não exige mlCustoFrete", () => {
    const produto = produtoBase({
      produtosMercadoLivre: [
        {
          mlStatus: "active",
          mlPrice: 2000,
          mlCustoFrete: null,
          mlTarifaVenda: 200,
          mlCustosAtualizadosEm: new Date(),
          mlFreeShipping: false,
        },
      ],
    });
    expect(codigosDe(produto)).not.toContain("SEM_FRETE");
  });

  it("SEM_TARIFA: anúncio ativo sem mlTarifaVenda", () => {
    const produto = produtoBase({
      produtosMercadoLivre: [
        {
          mlStatus: "active",
          mlPrice: 2000,
          mlCustoFrete: 0,
          mlTarifaVenda: null,
          mlCustosAtualizadosEm: new Date(),
          mlFreeShipping: false,
        },
      ],
    });
    expect(codigosDe(produto)).toContain("SEM_TARIFA");
  });

  it("SEM_PRAZO_FORNECEDOR: fornecedor principal sem prazoEntregaDias", () => {
    const produto = produtoBase({
      fornecedores: [{ principal: true, prazoEntregaDias: null }],
    });
    expect(codigosDe(produto)).toContain("SEM_PRAZO_FORNECEDOR");
  });

  it("MARGEM_NEGATIVA: custo + tarifa + frete maior que o preço", () => {
    const produto = produtoBase({
      custoMedio: 1800,
      produtosMercadoLivre: [
        {
          mlStatus: "active",
          mlPrice: 2000,
          mlCustoFrete: 300,
          mlTarifaVenda: 300,
          mlCustosAtualizadosEm: new Date(),
          mlFreeShipping: true,
        },
      ],
    });
    expect(codigosDe(produto)).toContain("MARGEM_NEGATIVA");
  });

  it("margem incompleta (sem tarifa) não aciona MARGEM_NEGATIVA", () => {
    const produto = produtoBase({
      custoMedio: 1800,
      produtosMercadoLivre: [
        {
          mlStatus: "active",
          mlPrice: 2000,
          mlCustoFrete: 300,
          mlTarifaVenda: null,
          mlCustosAtualizadosEm: new Date(),
          mlFreeShipping: true,
        },
      ],
    });
    expect(codigosDe(produto)).not.toContain("MARGEM_NEGATIVA");
  });

  it("ESTOQUE_DIVERGENTE: repassa a flag pré-computada", () => {
    expect(
      codigosDe(produtoBase({ estoqueDivergente: true }))
    ).toContain("ESTOQUE_DIVERGENTE");
  });

  it("VENDA_INCOMPLETA: repassa a flag pré-computada pelo financeiro", () => {
    expect(
      codigosDe(produtoBase({ vendaIncompleta: true }))
    ).toContain("VENDA_INCOMPLETA");
  });

  it("sem venda incompleta não gera VENDA_INCOMPLETA", () => {
    expect(
      codigosDe(produtoBase({ vendaIncompleta: false }))
    ).not.toContain("VENDA_INCOMPLETA");
  });

  it("SEM_EAN: produto sem GTIN", () => {
    expect(codigosDe(produtoBase({ ean: null }))).toContain("SEM_EAN");
  });

  it("SEM_VINCULO_ML: produto sem nenhum anúncio", () => {
    expect(codigosDe(produtoBase({ produtosMercadoLivre: [] }))).toContain(
      "SEM_VINCULO_ML"
    );
  });

  it("cada pendência tem severidade e mensagem", () => {
    const pendencias = calcularPendencias(
      produtoBase({ custoMedio: null, ean: null })
    );
    for (const p of pendencias) {
      expect(["critica", "atencao", "informativa"]).toContain(p.severidade);
      expect(p.mensagem.length).toBeGreaterThan(0);
      expect(p.acao.length).toBeGreaterThan(0);
    }
  });
});
