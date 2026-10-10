import { describe, it, expect } from "vitest";
import {
  calcularResultadoVenda,
  calcularMargemContribuicao,
  calcularPontoEquilibrio,
  ratearCustoFixoPorProduto,
  ratearCustoVendaPorItem,
  type ItemVendaEntrada,
} from "../formulas";

const SEM_IMPOSTO = { aliquotaImposto: 0 };
const IMPOSTO_6 = { aliquotaImposto: 0.06 };

function item(parcial: Partial<ItemVendaEntrada> = {}): ItemVendaEntrada {
  return {
    produtoId: "produto-1",
    quantidade: 1,
    precoUnitario: 10000,
    tarifaTotal: 1000,
    descontoVendedorTotal: 0,
    custoUnitario: 5000,
    ...parcial,
  };
}

describe("calcularResultadoVenda", () => {
  it("venda simples de 1 item, sem frete e sem ads: margem = preço - tarifa - custo", () => {
    const resultado = calcularResultadoVenda(
      { freteTotal: 0, adsAtribuido: 0 },
      [item()],
      SEM_IMPOSTO
    );

    expect(resultado.completo).toBe(true);
    expect(resultado.faturamentoBruto).toBe(10000);
    expect(resultado.margemContribuicao).toBe(10000 - 1000 - 5000);
  });

  it("venda com kit: custoUnitario já é a soma dos componentes resolvida pela ingestão", () => {
    // kit = 2x componente A (custo 500) + 1x componente B (custo 300) = 1300
    const resultado = calcularResultadoVenda(
      { freteTotal: 0, adsAtribuido: 0 },
      [item({ produtoId: "kit-1", precoUnitario: 5000, tarifaTotal: 400, custoUnitario: 1300 })],
      SEM_IMPOSTO
    );

    expect(resultado.completo).toBe(true);
    expect(resultado.cmv).toBe(1300);
    expect(resultado.margemContribuicao).toBe(5000 - 400 - 1300);
  });

  it("venda com 2 itens e frete único: rateia proporcional ao faturamento sem perder centavo", () => {
    const itens = [
      item({ produtoId: "a", precoUnitario: 3000, quantidade: 1, tarifaTotal: 300, custoUnitario: 1000 }),
      item({ produtoId: "b", precoUnitario: 7000, quantidade: 1, tarifaTotal: 700, custoUnitario: 2000 }),
    ];

    const resultado = calcularResultadoVenda(
      { freteTotal: 1000, adsAtribuido: 0 },
      itens,
      SEM_IMPOSTO
    );

    const [freteA, freteB] = resultado.itens.map((i) => i.freteRateado as number);
    expect(freteA + freteB).toBe(1000);
    expect(freteB).toBeGreaterThan(freteA); // item b faturou mais, logo carrega mais frete
    expect(resultado.freteVendedor).toBe(1000);
    expect(resultado.completo).toBe(true);
  });

  it("venda cancelada e totalmente revertida (tarifa também devolvida): não sobra nem falta nada", () => {
    const resultado = calcularResultadoVenda(
      { freteTotal: 0, adsAtribuido: 0 },
      [item({ quantidade: 0, tarifaTotal: 0, custoUnitario: 0 })],
      SEM_IMPOSTO
    );

    expect(resultado.faturamentoBruto).toBe(0);
    expect(resultado.margemContribuicao).toBe(0);
  });

  it("venda cancelada com tarifa não reembolsada pelo canal: a perda aparece de verdade, não é escondida", () => {
    const resultado = calcularResultadoVenda(
      { freteTotal: 0, adsAtribuido: 0 },
      [item({ quantidade: 0, tarifaTotal: 500, custoUnitario: 0 })],
      SEM_IMPOSTO
    );

    expect(resultado.margemContribuicao).toBe(-500);
  });

  it("devolução parcial: a quantidade líquida (mantida) já reflete o que não voltou", () => {
    // pedido original tinha 3 unidades, 2 foram devolvidas: fica 1 unidade válida
    const resultado = calcularResultadoVenda(
      { freteTotal: 0, adsAtribuido: 0 },
      [item({ quantidade: 1, precoUnitario: 2000, tarifaTotal: 200, custoUnitario: 800 })],
      SEM_IMPOSTO
    );

    expect(resultado.faturamentoBruto).toBe(2000);
    expect(resultado.margemContribuicao).toBe(2000 - 200 - 800);
  });

  it("produto sem custo: CMV nulo, venda incompleta, pendência SEM_CUSTO", () => {
    const resultado = calcularResultadoVenda(
      { freteTotal: 0, adsAtribuido: 0 },
      [item({ custoUnitario: null })],
      SEM_IMPOSTO
    );

    expect(resultado.completo).toBe(false);
    expect(resultado.cmv).toBeNull();
    expect(resultado.margemContribuicao).toBeNull();
    expect(resultado.faltando).toContain("SEM_CUSTO");
  });

  it("frete desconhecido (Flex ainda sem custo configurado): venda incompleta, pendência SEM_FRETE", () => {
    const resultado = calcularResultadoVenda(
      { freteTotal: null, adsAtribuido: 0 },
      [item()],
      SEM_IMPOSTO
    );

    expect(resultado.completo).toBe(false);
    expect(resultado.itens[0].freteRateado).toBeNull();
    expect(resultado.faltando).toContain("SEM_FRETE");
  });

  it("Flex com custo de envio configurado: entra como um frete normal, sem tratamento especial", () => {
    const resultado = calcularResultadoVenda(
      { freteTotal: 1500, adsAtribuido: 0 },
      [item()],
      SEM_IMPOSTO
    );

    expect(resultado.completo).toBe(true);
    expect(resultado.itens[0].freteRateado).toBe(1500);
  });

  it("Full: frete do vendedor é zero (custo de armazenagem vem de outra fonte na Fase 4), margem calcula normalmente", () => {
    const resultado = calcularResultadoVenda(
      { freteTotal: 0, adsAtribuido: 0 },
      [item({ precoUnitario: 8000, tarifaTotal: 1200, custoUnitario: 3000 })],
      SEM_IMPOSTO
    );

    expect(resultado.completo).toBe(true);
    expect(resultado.margemContribuicao).toBe(8000 - 1200 - 3000);
  });

  it("item abaixo do valor da taxa fixa: tarifa pode superar o preço e a margem fica negativa, sem quebrar", () => {
    const resultado = calcularResultadoVenda(
      { freteTotal: 0, adsAtribuido: 0 },
      [item({ precoUnitario: 500, tarifaTotal: 600, custoUnitario: 100 })],
      SEM_IMPOSTO
    );

    expect(resultado.completo).toBe(true);
    expect(resultado.margemContribuicao).toBe(500 - 600 - 100);
    expect(resultado.margemContribuicao).toBeLessThan(0);
  });

  it("desconto custeado pelo ML não reduz a receita do vendedor; só o custeado pelo vendedor entra na fórmula", () => {
    const custeadoPeloVendedor = calcularResultadoVenda(
      { freteTotal: 0, adsAtribuido: 0 },
      [item({ precoUnitario: 10000, descontoVendedorTotal: 1000, tarifaTotal: 0, custoUnitario: 0 })],
      SEM_IMPOSTO
    );
    const semDescontoDoVendedor = calcularResultadoVenda(
      { freteTotal: 0, adsAtribuido: 0 },
      [item({ precoUnitario: 10000, descontoVendedorTotal: 0, tarifaTotal: 0, custoUnitario: 0 })],
      SEM_IMPOSTO
    );

    // o desconto do ML já não aparece em nenhum campo de entrada — faturamentoBruto
    // (preço pago) é igual nos dois casos, só a margem muda pelo desconto do vendedor
    expect(custeadoPeloVendedor.faturamentoBruto).toBe(semDescontoDoVendedor.faturamentoBruto);
    expect(custeadoPeloVendedor.margemContribuicao).toBe(
      (semDescontoDoVendedor.margemContribuicao as number) - 1000
    );
  });

  it("imposto incide sobre o faturamento já líquido do desconto do vendedor", () => {
    const resultado = calcularResultadoVenda(
      { freteTotal: 0, adsAtribuido: 0 },
      [item({ precoUnitario: 10000, descontoVendedorTotal: 2000, tarifaTotal: 0, custoUnitario: 0 })],
      IMPOSTO_6
    );

    expect(resultado.imposto).toBe(Math.round((10000 - 2000) * 0.06));
  });

  it("ads sem venda no dia é zero mas não falta — não entra em faltando", () => {
    const resultado = calcularResultadoVenda(
      { freteTotal: 0, adsAtribuido: 0 },
      [item()],
      SEM_IMPOSTO
    );

    expect(resultado.completo).toBe(true);
    expect(resultado.adsAtribuido).toBe(0);
  });
});

describe("ratearCustoVendaPorItem", () => {
  it("reparte proporcional ao faturamento (preço x quantidade) de cada item", () => {
    const partes = ratearCustoVendaPorItem(1000, [
      { precoUnitario: 100, quantidade: 1 },
      { precoUnitario: 100, quantidade: 3 },
    ]);

    expect(partes.reduce((a, b) => a + b, 0)).toBe(1000);
    expect(partes).toEqual([250, 750]);
  });
});

describe("calcularMargemContribuicao", () => {
  it("subtrai todos os componentes do faturamento bruto", () => {
    const margem = calcularMargemContribuicao({
      faturamentoBruto: 10000,
      descontoVendedor: 500,
      imposto: 300,
      tarifa: 1000,
      frete: 800,
      ads: 200,
      cmv: 4000,
    });

    expect(margem).toBe(10000 - 500 - 300 - 1000 - 800 - 200 - 4000);
  });
});

describe("calcularPontoEquilibrio", () => {
  it("despesas fixas dividido pela margem de contribuição percentual", () => {
    expect(calcularPontoEquilibrio(10000, 0.5)).toBe(20000);
  });

  it("margem de contribuição zero ou negativa: ponto de equilíbrio impossível, devolve null", () => {
    expect(calcularPontoEquilibrio(10000, 0)).toBeNull();
    expect(calcularPontoEquilibrio(10000, -0.1)).toBeNull();
  });
});

describe("ratearCustoFixoPorProduto", () => {
  const produtos = [
    { produtoId: "a", faturamento: 1000, unidadesVendidas: 1 },
    { produtoId: "b", faturamento: 3000, unidadesVendidas: 9 },
  ];

  it("método FATURAMENTO: proporcional à receita de cada produto", () => {
    const rateio = ratearCustoFixoPorProduto(400, produtos, "FATURAMENTO");

    expect(rateio.a + rateio.b).toBe(400);
    expect(rateio.b).toBeGreaterThan(rateio.a);
  });

  it("método UNIDADE: proporcional às unidades vendidas", () => {
    const rateio = ratearCustoFixoPorProduto(400, produtos, "UNIDADE");

    expect(rateio.a + rateio.b).toBe(400);
    expect(rateio.a).toBe(40); // 1 de 10 unidades
    expect(rateio.b).toBe(360); // 9 de 10 unidades
  });

  it("método NENHUM: não rateia, cada produto fica com zero", () => {
    const rateio = ratearCustoFixoPorProduto(400, produtos, "NENHUM");

    expect(rateio.a).toBe(0);
    expect(rateio.b).toBe(0);
  });
});
