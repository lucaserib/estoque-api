import { describe, it, expect, vi, beforeEach } from "vitest";
import { criarBancoFalso } from "../../__tests__/bancoFalso";

const banco = criarBancoFalso();

vi.mock("@/lib/prisma", () => ({ prisma: banco.prisma }));
vi.mock("@/lib/cache", () => ({
  withUserCache: vi.fn(async (_userId: string, _key: string, fetcher: () => Promise<unknown>) => fetcher()),
  mlCache: { invalidatePattern: vi.fn(async () => 0) },
}));

const { calcularIndicadores, calcularVenda, obterConfigRelatorio, buscarVendasParaCalculo } = await import("../motor");
const { gerarDre } = await import("../dre");
const { gerarResumoPeriodo, gerarSerieDiaria, gerarResumoDia } = await import("../resumoDia");
const { gerarLucroPorProduto } = await import("../lucroPorProduto");
const { calcularResumoPorLogistica } = await import("../porLogistica");
const { listarVendasComLucro } = await import("../lucroPorVenda");

const OUT_INICIO = new Date("2026-10-01T03:00:00.000Z");
const OUT_FIM = new Date("2026-11-01T02:59:59.999Z");

function item(parcial: Record<string, unknown> = {}) {
  return {
    produtoId: "prod-kit",
    quantidade: 1,
    precoUnitario: 3470,
    precoCheio: 7000,
    custoUnitario: 1800,
    descontoCusteadoMl: 0,
    titulo: "Kit 2 Adaptador",
    sku: "KITADAPBRA",
    anuncioExternoId: "MLB4019629019",
    ...parcial,
  };
}

/** Pedido real 2000019043297364: R$ 34,70, tarifa 2,99 (2,24 + 0,71 + 0,04), frete 6,85, retenção 12,14, líquido 12,72. */
function vendaReal(parcial: Record<string, unknown> = {}) {
  return banco.venda({
    pedidoExternoId: "2000019043297364",
    dataVenda: new Date("2026-10-18T16:01:27.000Z"),
    faturamentoBruto: 3470,
    descontoVendedor: 3430,
    tarifaVenda: 299,
    freteVendedor: 685,
    freteComprador: 0,
    cmv: 1800,
    valorLiquidoReceber: 1272,
    retencaoDividas: 1214,
    dataLiberacao: new Date("2026-11-16T16:01:31.000Z"),
    itens: [item()],
    ...parcial,
  });
}

beforeEach(() => {
  banco.dados.vendas = [];
  banco.dados.lancamentos = [];
  banco.dados.cobrancas = [];
  banco.dados.ads = [];
  banco.dados.produtos = [
    { id: "prod-kit", nome: "Kit 2 Adaptador", sku: "KITADAPBRA" },
    { id: "prod-luva", nome: "Luva", sku: "LUVAMA" },
  ];
  banco.dados.config = {
    aliquotaImposto: 0.06,
    modoFaturamento: "PRODUTOS",
    regimeTributario: "SIMPLES",
    usarImpostoEstimado: true,
    rateioCustoFixo: "FATURAMENTO",
    metaFaturamentoMensal: null,
  };
});

describe("calcularVenda — pedido real", () => {
  it("faturamento = preço × quantidade; desconto de campanha é só informativo", async () => {
    const config = await obterConfigRelatorio("user-1");
    const r = calcularVenda(vendaReal() as never, config);
    expect(r.faturamento).toBe(3470);
    expect(r.receitaTotal).toBe(3470);
    expect(r.imposto).toBe(208);
    expect(r.tarifa).toBe(299);
    expect(r.frete).toBe(685);
    expect(r.cmv).toBe(1800);
    expect(r.margemContribuicao).toBe(3470 - 208 - 299 - 685 - 1800);
    expect(r.descontoCampanha).toBe(3430);
  });

  it("modo faturamento líquido de frete desconta o frete do faturamento e não o cobra de novo; a margem não muda", async () => {
    banco.dados.config = { ...banco.dados.config, modoFaturamento: "PRODUTOS_MENOS_FRETE" };
    const config = await obterConfigRelatorio("user-1");
    const r = calcularVenda(vendaReal({ freteComprador: 500 }) as never, config);
    expect(r.receitaFrete).toBe(-685);
    expect(r.receitaTotal).toBe(3470 - 685);
    expect(r.frete).toBe(0);
    expect(r.margemContribuicao).toBe(3470 - 208 - 299 - 685 - 1800);
  });

  it("modo produtos + frete do comprador soma só o que o comprador pagou", async () => {
    banco.dados.config = { ...banco.dados.config, modoFaturamento: "PRODUTOS_E_FRETE_COMPRADOR" };
    const config = await obterConfigRelatorio("user-1");
    const r = calcularVenda(vendaReal({ freteComprador: 500 }) as never, config);
    expect(r.receitaFrete).toBe(500);
    expect(r.frete).toBe(685 + 500);
    expect(r.margemContribuicao).toBe(3470 - 208 - 299 - 685 - 1800);
  });

  it("modo produtos + frete total (igual ao Bling/Mercado Turbo) soma o frete inteiro; a margem cresce o valor do frete que o vendedor absorveu, porque esse frete passa a contar como faturamento gerado, não só como custo", async () => {
    banco.dados.config = { ...banco.dados.config, modoFaturamento: "PRODUTOS_E_FRETE_TOTAL" };
    const config = await obterConfigRelatorio("user-1");
    const comprador = calcularVenda(vendaReal({ freteComprador: 500 }) as never, {
      ...config,
      modoFaturamento: "PRODUTOS_E_FRETE_COMPRADOR" as never,
    });
    const r = calcularVenda(vendaReal({ freteComprador: 500 }) as never, config);
    expect(r.receitaFrete).toBe(685 + 500);
    expect(r.receitaTotal).toBe(3470 + 685 + 500);
    expect(r.frete).toBe(685 + 500);
    // Mesmo custo de frete do modo "comprador" (685+500) — só a receita de frete é que também
    // soma o freteVendedor, então a margem sobe exatamente esse valor em relação aos outros modos.
    expect(r.frete).toBe(comprador.frete);
    expect(r.margemContribuicao).toBe(comprador.margemContribuicao + 685);
  });

  it("venda cancelada não tem faturamento, imposto nem CMV; tarifa/frete só se confirmados no pagamento", async () => {
    const config = await obterConfigRelatorio("user-1");
    const semDetalhe = calcularVenda(vendaReal({ status: "CANCELADA", enriquecidoEm: null }) as never, config);
    expect(semDetalhe.faturamento).toBe(0);
    expect(semDetalhe.cancelamento).toBe(3470);
    expect(semDetalhe.margemContribuicao).toBe(0);

    const comDetalhe = calcularVenda(vendaReal({ status: "CANCELADA", tarifaVenda: 0, freteVendedor: 685 }) as never, config);
    expect(comDetalhe.margemContribuicao).toBe(-685);
  });

  it("devolução parcial abate só o valor estornado", async () => {
    const config = await obterConfigRelatorio("user-1");
    const r = calcularVenda(vendaReal({ status: "DEVOLVIDA_PARCIAL", valorEstornado: 1000 }) as never, config);
    expect(r.valida).toBe(true);
    expect(r.cancelamento).toBe(1000);
    expect(r.faturamento).toBe(2470);
  });

  it("venda sem custo é sinalizada e entra com CMV zero (nunca esconde a venda)", async () => {
    const config = await obterConfigRelatorio("user-1");
    const r = calcularVenda(vendaReal({ cmv: null, itens: [item({ custoUnitario: null })] }) as never, config);
    expect(r.semCusto).toBe(true);
    expect(r.cmv).toBe(0);
  });
});

describe("calcularIndicadores — uma fórmula para tudo", () => {
  function popularOutubro() {
    banco.dados.vendas.push(
      vendaReal(),
      vendaReal({ pedidoExternoId: "2", dataVenda: new Date("2026-10-05T12:00:00Z") }),
      vendaReal({ pedidoExternoId: "3", status: "CANCELADA", dataVenda: new Date("2026-10-06T12:00:00Z"), tarifaVenda: 0, freteVendedor: 0 }),
      vendaReal({
        pedidoExternoId: "4",
        dataVenda: new Date("2026-10-07T12:00:00Z"),
        faturamentoBruto: 5000,
        tarifaVenda: 600,
        freteVendedor: null,
        cmv: null,
        enriquecidoEm: null,
        logistica: "self_service",
        itens: [item({ produtoId: "prod-luva", precoUnitario: 2500, quantidade: 2, custoUnitario: null })],
      }),
      vendaReal({ pedidoExternoId: "fora", dataVenda: new Date("2026-11-01T03:30:00Z") })
    );
    banco.dados.lancamentos.push(
      {
        userId: "user-1",
        tipo: "DESPESA",
        valor: 2000,
        status: "PAGO",
        competencia: new Date("2026-10-10T12:00:00Z"),
        categoriaId: "cat-aluguel",
        categoria: { nome: "Ocupação", grupoDre: "DESPESA_OPERACIONAL" },
      },
      {
        userId: "user-1",
        tipo: "DESPESA",
        valor: 999999,
        status: "CANCELADO",
        competencia: new Date("2026-10-10T12:00:00Z"),
        categoriaId: "cat-aluguel",
        categoria: { nome: "Ocupação", grupoDre: "DESPESA_OPERACIONAL" },
      },
      {
        userId: "user-1",
        tipo: "DESPESA",
        valor: 50000,
        status: "PAGO",
        competencia: new Date("2026-10-10T12:00:00Z"),
        categoriaId: "cat-compra",
        categoria: { nome: "Compra de mercadoria (estoque)", grupoDre: "CMV" },
      }
    );
    banco.dados.cobrancas.push(
      { userId: "user-1", canal: "MERCADO_LIVRE", contaCanalId: "conta-1", data: new Date("2026-10-20T12:00:00Z"), tipoNormalizado: "ARMAZENAGEM_FULL", coberturaPedido: false, valor: 300 },
      { userId: "user-1", canal: "MERCADO_LIVRE", contaCanalId: "conta-1", data: new Date("2026-10-20T12:00:00Z"), tipoNormalizado: "TARIFA_VENDA", coberturaPedido: true, valor: 299 },
      { userId: "user-1", canal: "MERCADO_LIVRE", contaCanalId: "conta-1", data: new Date("2026-10-20T12:00:00Z"), tipoNormalizado: "PUBLICIDADE", coberturaPedido: false, valor: 1500 }
    );
  }

  it("totaliza o mês igual ao Mercado Livre e leva a margem até o lucro líquido", async () => {
    popularOutubro();
    const ind = await calcularIndicadores("user-1", OUT_INICIO, OUT_FIM);

    expect(ind.pedidos).toBe(3);
    expect(ind.vendas.pedidosCancelados).toBe(1);
    expect(ind.unidades).toBe(4);
    expect(ind.faturamento).toBe(3470 + 3470 + 5000);
    expect(ind.cancelamentos).toBe(3470);
    expect(ind.impostos).toBe(208 + 208 + 300);
    expect(ind.custosVariaveis.tarifas).toBe(299 + 299 + 600);
    expect(ind.custosVariaveis.frete).toBe(685 + 685);
    expect(ind.custosVariaveis.ads).toBe(1500);
    expect(ind.origemAds).toBe("FATURA");
    expect(ind.custosVariaveis.armazenagemFull).toBe(300);
    expect(ind.cmv).toBe(1800 + 1800);

    const mcEsperada =
      ind.receitaTotal - ind.impostos - (1198 + 1370 + 1500 + 300) - 3600;
    expect(ind.margemContribuicao).toBe(mcEsperada);
    expect(ind.totalDespesasOperacionais).toBe(2000);
    expect(ind.lucroLiquido).toBe(mcEsperada - 2000);
    expect(ind.qualidade.vendasSemCusto).toBe(1);
    expect(ind.qualidade.faturamentoSemCusto).toBe(5000);
    expect(ind.qualidade.vendasAguardandoDetalhes).toBe(1);
    expect(ind.qualidade.lucroConfiavel).toBe(false);
  });

  it("ads diário tem prioridade sobre a cobrança PADS da fatura (sem contar duas vezes)", async () => {
    popularOutubro();
    banco.dados.ads.push({ userId: "user-1", dia: new Date("2026-10-08T03:00:00Z"), custo: 700 });
    const ind = await calcularIndicadores("user-1", OUT_INICIO, OUT_FIM);
    expect(ind.custosVariaveis.ads).toBe(700);
    expect(ind.origemAds).toBe("ADS_DIARIO");
  });

  it("DRE do mês é exatamente o calcularIndicadores do mês", async () => {
    popularOutubro();
    const ind = await calcularIndicadores("user-1", OUT_INICIO, OUT_FIM);
    const dre = await gerarDre("user-1", { ano: 2026, mes: 10 }, 2);
    expect(dre.meses).toHaveLength(2);
    const outubro = dre.meses[1];
    expect(outubro.competencia).toEqual({ ano: 2026, mes: 10 });
    expect(outubro.faturamento).toBe(ind.faturamento);
    expect(outubro.margemContribuicao).toBe(ind.margemContribuicao);
    expect(outubro.lucroLiquido).toBe(ind.lucroLiquido);
    expect(dre.meses[0].pedidos).toBe(0);
  });

  it("resumo do período usa o mesmo número da DRE e não chama 'meta batida' quando não há despesas", async () => {
    popularOutubro();
    banco.dados.lancamentos = banco.dados.lancamentos.filter((l) => l.status === "CANCELADO");
    const resumo = await gerarResumoPeriodo("user-1", OUT_INICIO, OUT_FIM);
    const dre = await gerarDre("user-1", { ano: 2026, mes: 10 }, 1);
    expect(resumo.indicadores.margemContribuicao).toBe(dre.meses[0].margemContribuicao);
    expect(resumo.pontoEquilibrioMes.pontoEquilibrio).toBeNull();
    expect(resumo.pontoEquilibrioMes.motivoIndisponivel).toBe("SEM_DESPESAS_CADASTRADAS");
  });

  it("série diária soma, dia a dia, a mesma margem das vendas", async () => {
    popularOutubro();
    const vendas = await buscarVendasParaCalculo("user-1", OUT_INICIO, OUT_FIM);
    const config = await obterConfigRelatorio("user-1");
    const somaMargem = vendas.reduce((s, v) => s + calcularVenda(v, config).margemContribuicao, 0);
    const serie = await gerarSerieDiaria("user-1", OUT_INICIO, new Date("2026-10-08T02:59:59.999Z"));
    expect(serie).toHaveLength(7);
    expect(serie.reduce((s, p) => s + p.margemContribuicao, 0)).toBe(
      somaMargem - calcularVenda(vendas.find((v) => v.pedidoExternoId === "2000019043297364")!, config).margemContribuicao
    );
  });

  it("lucro por produto: a soma da margem dos produtos é a margem das vendas do período", async () => {
    popularOutubro();
    const vendas = await buscarVendasParaCalculo("user-1", OUT_INICIO, OUT_FIM);
    const config = await obterConfigRelatorio("user-1");
    const somaVendas = vendas.reduce((s, v) => s + calcularVenda(v, config).margemContribuicao, 0);
    const linhas = await gerarLucroPorProduto("user-1", { desde: OUT_INICIO, ate: OUT_FIM });
    expect(linhas.reduce((s, l) => s + l.margemContribuicao, 0)).toBe(somaVendas);
    const luva = linhas.find((l) => l.produtoId === "prod-luva")!;
    expect(luva.vendasSemCusto).toBe(1);
    expect(luva.unidades).toBe(2);
  });

  it("por logística traduz os nomes e usa a mesma margem", async () => {
    popularOutubro();
    const linhas = await calcularResumoPorLogistica("user-1", OUT_INICIO, OUT_FIM);
    const full = linhas.find((l) => l.logistica === "fulfillment")!;
    const flex = linhas.find((l) => l.logistica === "self_service")!;
    expect(full.rotulo).toBe("Full");
    expect(flex.rotulo).toBe("Flex");
    expect(full.pedidos).toBe(2);
    expect(full.pedidosCancelados).toBe(1);
  });

  it("lista de vendas traz o cálculo do motor em cada venda", async () => {
    popularOutubro();
    const lista = await listarVendasComLucro("user-1", { desde: OUT_INICIO, ate: OUT_FIM, porPagina: 50 });
    expect(lista.total).toBe(4);
    const real = lista.vendas.find((v) => v.pedidoExternoId === "2000019043297364")!;
    expect(real.calculo.margemContribuicao).toBe(3470 - 208 - 299 - 685 - 1800);
    expect(real.logisticaRotulo).toBe("Full");
  });

  it("resumo do dia compara com ontem sem percentuais absurdos sobre base pequena", async () => {
    banco.dados.vendas.push(
      vendaReal({ pedidoExternoId: "hoje", dataVenda: new Date("2026-10-18T15:00:00Z") }),
      vendaReal({ pedidoExternoId: "ontem", dataVenda: new Date("2026-10-17T15:00:00Z"), faturamentoBruto: 500, itens: [item({ precoUnitario: 500 })] })
    );
    const resumo = await gerarResumoDia("user-1", new Date("2026-10-18T18:00:00Z"));
    expect(resumo.indicadores.pedidos).toBe(1);
    expect(resumo.comparacaoOntem.faturamento.percentual).toBeNull();
    expect(resumo.comparacaoOntem.pedidos.percentual).toBeNull();
  });

  it("mesma venda, mesmo número em Vendas, DRE, resumo do período (Visão geral/dashboard) e Produtos", async () => {
    banco.dados.vendas.push(vendaReal());

    const margemEsperada = 3470 - 208 - 299 - 685 - 1800;

    const [dre, resumo, linhasPorProduto, listaVendas] = await Promise.all([
      gerarDre("user-1", { ano: 2026, mes: 10 }, 1),
      gerarResumoPeriodo("user-1", OUT_INICIO, OUT_FIM),
      gerarLucroPorProduto("user-1", { desde: OUT_INICIO, ate: OUT_FIM }),
      listarVendasComLucro("user-1", { desde: OUT_INICIO, ate: OUT_FIM, porPagina: 10 }),
    ]);

    expect(dre.meses[0].margemContribuicao).toBe(margemEsperada);
    expect(resumo.indicadores.margemContribuicao).toBe(margemEsperada);
    const kit = linhasPorProduto.find((l) => l.produtoId === "prod-kit")!;
    expect(kit.margemContribuicao).toBe(margemEsperada);
    const vendaNaLista = listaVendas.vendas.find((v) => v.pedidoExternoId === "2000019043297364")!;
    expect(vendaNaLista.calculo.margemContribuicao).toBe(margemEsperada);

    expect(resumo.indicadores.faturamento).toBe(dre.meses[0].faturamento);
    expect(vendaNaLista.calculo.faturamento).toBe(dre.meses[0].faturamento);
    expect(kit.faturamentoBruto).toBe(dre.meses[0].faturamento);
  });
});
