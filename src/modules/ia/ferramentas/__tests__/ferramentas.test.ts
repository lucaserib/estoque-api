import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  produto: { findFirst: vi.fn() },
  vendaCanalItem: { findMany: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const indicadores = {
  pedidos: 10,
  unidades: 12,
  faturamento: 100000,
  receitaFrete: 0,
  receitaTotal: 100000,
  ticketMedio: 10000,
  cancelamentos: 0,
  impostos: 6000,
  custosVariaveis: { tarifas: 12000, frete: 8000, ads: 3000, armazenagemFull: 0, outrasCobrancas: 0, outrosCustos: 0, lancamentos: 0, total: 23000 },
  cmv: 40000,
  margemContribuicao: 31000,
  margemContribuicaoPercentual: 0.31,
  totalDespesasOperacionais: 5000,
  lucroLiquido: 26000,
  lucroLiquidoPercentual: 0.26,
  liquidoAReceber: 70000,
  qualidade: { vendasSemCusto: 0, vendasAguardandoDetalhes: 1, vendasSemVinculo: 0, lucroConfiavel: false },
};

const motor = {
  calcularIndicadores: vi.fn(async () => indicadores),
  buscarVendasParaCalculo: vi.fn(async () => []),
  obterConfigRelatorio: vi.fn(async () => ({})),
  agruparVendas: vi.fn(() => new Map()),
};
vi.mock("@/modules/financeiro/relatorios/motor", () => motor);

const linhaProduto = {
  produtoId: "p1",
  sku: "SKU1",
  nome: "Borrifador",
  unidades: 5,
  faturamentoBruto: 50000,
  descontos: 0,
  tarifa: 6000,
  frete: 3000,
  ads: 0,
  imposto: 3000,
  cmv: 20000,
  margemContribuicao: 18000,
  margemContribuicaoPercentual: 0.36,
  custoFixoRateado: 1000,
  lucroLiquido: 17000,
  roiSobreCmv: 0.85,
  curvaAbc: "A",
  vendasSemCusto: 0,
};
const lucro = { gerarLucroPorProduto: vi.fn(async () => [linhaProduto]) };
vi.mock("@/modules/financeiro/relatorios/lucroPorProduto", () => lucro);

const faturamento = {
  calcularFaturamentoComFrete: vi.fn(async () => ({
    totais: { pedidos: 1, produtos: 100, freteComprador: 0, freteVendedor: 0, comFrete: 100, notasQuantidade: 0, notasValor: 0, notasFrete: 0, pedidosComNota: 0 },
    dias: [],
    coberturaNotas: null,
    temNotas: false,
  })),
};
vi.mock("@/modules/financeiro/relatorios/faturamentoComFrete", () => faturamento);

const sugestao = {
  produtoId: "p1",
  nome: "Borrifador",
  sku: "SKU1",
  custoMedio: 4000,
  estoqueLocal: 2,
  estoqueFullDisponivel: 0,
  estoqueFullEmTransito: 0,
  estoqueFullIndisponivel: 0,
  pedidosEmAbertoUnidades: 0,
  estoqueEmKitsUnidades: 0,
  temAnuncioFull: false,
  ehKit: false,
  demandaDiaria: 1.5,
  leadTimeDias: 10,
  estoqueDisponivel: 2,
  pontoPedido: 20,
  coberturaDias: 1.3,
  coberturaDiasLocal: 1.3,
  coberturaDiasFull: null,
  dataRupturaPrevista: "2026-11-21",
  quantidadeSugeridaCompraUnidades: 30,
  quantidadeSugeridaCompraCaixas: 3,
  quantidadeSugeridaEnvioFull: 0,
  custoTotalCompra: 120000,
  custoIndefinido: false,
  fornecedorPrincipalId: "f1",
  fornecedorPrincipalNome: "Fornecedor Alfa",
  status: "critico",
};
const reposicao = {
  calcularReposicaoConta: vi.fn(async () => ({ sugestoes: [sugestao], parcial: false })),
  calcularCapitalParadoConta: vi.fn(async () => [
    { produtoId: "p2", nome: "Parado", sku: "SKU2", estoqueLocal: 10, custoMedio: 1000, valorParado: 10000, ultimaVenda: null, diasSemVenda: null },
  ]),
};
vi.mock("@/services/reposicaoService", () => reposicao);

const pendencias = {
  calcularTodasPendencias: vi.fn(async () => [
    { produtoId: "p1", nome: "Borrifador", sku: "SKU1", estoqueTotal: 2, custoMedio: null, pendencias: [{ codigo: "SEM_CUSTO", severidade: "critica", mensagem: "Sem custo", acao: "Definir custo" }] },
  ]),
};
vi.mock("@/services/pendenciasService", () => pendencias);

const saude = {
  calcularSaudeAnuncios: vi.fn(async () => ({
    totalAtivos: 3,
    grupos: [
      {
        categoria: "SEM_ESTOQUE",
        titulo: "Sem estoque",
        descricao: "d",
        linkFiltro: "/mercado-livre?f=sem-estoque",
        acao: "Ver",
        anuncios: [{ id: "a1", mlItemId: "MLB1", mlTitle: "Borrifador", mlThumbnail: null, mlPermalink: null, produtoId: "p1", produtoNome: "Borrifador", produtoSku: "SKU1" }],
      },
    ],
  })),
};
vi.mock("@/services/saudeAnunciosService", () => saude);

const lista = {
  normalizarTexto: (v: string) => v.toLowerCase(),
  listarProdutos: vi.fn(async () => ({
    itens: [
      {
        id: "p1",
        nome: "Borrifador",
        sku: "SKU1",
        codigoEAN: null,
        isKit: false,
        ativo: true,
        custoMedio: 4000,
        fornecedorPrincipal: { id: "f1", nome: "Fornecedor Alfa", prazoEntregaDias: 10 },
        estoqueLocal: 2,
        estoqueFull: 0,
        vendas90d: 40,
        anuncios: 1,
        pendencias: [],
      },
    ],
    total: 1,
  })),
};
vi.mock("@/modules/catalogo/listaProdutos", () => lista);

const diagnostico = {
  gerarDiagnostico: vi.fn(async () => ({
    nota: 70,
    classificacao: "boa",
    areas: [{ area: "estoque", titulo: "Estoque", nota: 80, problemas: 1 }],
    contexto: { produtosAtivos: 1 },
    incompleto: [],
    itens: [
      {
        id: "estoque-ruptura-prevista",
        area: "estoque",
        gravidade: "atencao",
        titulo: "Vão acabar",
        descricao: "d",
        quantidade: 1,
        valorEmRisco: 120000,
        acao: { rotulo: "Ver", href: "/reposicao" },
        exemplos: ["Pedido do cliente joao@exemplo.com"],
      },
    ],
  })),
};
vi.mock("@/modules/controle/diagnostico", () => diagnostico);

const { executarFerramenta, ferramentasDoPapel, definicoesParaApi, montarContextoFerramenta, TODAS_AS_FERRAMENTAS } =
  await import("../registro");

const agora = new Date("2026-11-20T15:00:00Z");
const admin = montarContextoFerramenta({ id: "user-a", contaId: "conta-a", role: "ADMIN" }, agora);
const estoque = montarContextoFerramenta({ id: "user-e", contaId: "conta-a", role: "ESTOQUE" }, agora);

function dados(conteudo: string) {
  const json = conteudo.replace("<dados_da_loja>\n", "").replace("\n</dados_da_loja>", "");
  return JSON.parse(json);
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.vendaCanalItem.findMany.mockResolvedValue([{ anuncioExternoId: "MLB1", quantidade: 2, precoUnitario: 5000 }]);
  prismaMock.produto.findFirst.mockResolvedValue({
    id: "p1",
    nome: "Borrifador",
    sku: "SKU1",
    ean: null,
    isKit: false,
    ativo: true,
    custoMedio: 4000,
    custoOrigem: "BLING",
    precoVenda: 9900,
    estoques: [{ quantidade: 2, armazem: { nome: "Loja", tipo: "LOCAL" } }],
    componentes: [],
    fornecedores: [{ prazoEntregaDias: 10, fornecedor: { nome: "Fornecedor Alfa" } }],
    ProdutoMercadoLivre: [],
  });
});

const ENTRADAS: Record<string, Record<string, unknown>> = {
  diagnostico_loja: {},
  resumo_financeiro: { periodo: "30d" },
  comparar_periodos: {},
  vendas_por_produto: { ordem: "margem" },
  vendas_por_dia: { periodo: "7d" },
  faturamento_com_frete: { periodo: "hoje" },
  sugestao_reposicao: {},
  capital_parado: {},
  pendencias_cadastro: {},
  saude_anuncios: {},
  buscar_produtos: { termo: "borri" },
  detalhe_produto: { sku: "SKU1" },
};

describe("registro por papel", () => {
  it("o modelo só vê as ferramentas que o papel pode usar", () => {
    expect(ferramentasDoPapel("ADMIN").map((f) => f.nome)).toEqual(TODAS_AS_FERRAMENTAS.map((f) => f.nome));
    const nomesEstoque = ferramentasDoPapel("ESTOQUE").map((f) => f.nome);
    expect(nomesEstoque).toContain("sugestao_reposicao");
    expect(nomesEstoque).not.toContain("resumo_financeiro");
    expect(nomesEstoque).not.toContain("capital_parado");
    expect(ferramentasDoPapel("VENDAS").map((f) => f.nome)).not.toContain("sugestao_reposicao");
    expect(ferramentasDoPapel("COMPRAS").map((f) => f.nome)).toContain("capital_parado");
    for (const papel of ["ADMIN", "COMPRAS", "ESTOQUE", "VENDAS", "LEITURA"] as const) {
      expect(ferramentasDoPapel(papel).map((f) => f.nome)).toContain("tarefas_da_equipe");
    }
  });

  it("gera JSON Schema válido para a API a partir do zod", () => {
    const defs = definicoesParaApi(TODAS_AS_FERRAMENTAS);
    expect(defs).toHaveLength(13);
    const reposicaoDef = defs.find((d) => d.name === "sugestao_reposicao")!;
    expect(reposicaoDef.input_schema).toMatchObject({
      type: "object",
      additionalProperties: false,
      properties: {
        urgencia: { type: "string", enum: ["critico", "atencao", "todos"], default: "todos" },
        limite: { type: "integer", minimum: 1, maximum: 30 },
      },
    });
    const periodo = defs.find((d) => d.name === "resumo_financeiro")!.input_schema as { properties: Record<string, { pattern?: string }> };
    expect(periodo.properties.desde.pattern).toBe("^\\d{4}-\\d{2}-\\d{2}$");
  });

  it("recusa ferramenta fora do papel como erro de ferramenta, sem derrubar nada", async () => {
    const r = await executarFerramenta("resumo_financeiro", { periodo: "hoje" }, estoque);
    expect(r.erro).toBe(true);
    expect(motor.calcularIndicadores).not.toHaveBeenCalled();
  });
});

describe("escopo por conta", () => {
  it.each(Object.keys(ENTRADAS))("%s usa só o contaId do servidor, mesmo se o modelo mandar outro", async (nome) => {
    const r = await executarFerramenta(nome, { ...ENTRADAS[nome], contaId: "conta-b", userId: "intruso" }, admin);
    expect(r.erro, r.conteudo).toBe(false);
    const chamadas = [
      ...motor.calcularIndicadores.mock.calls,
      ...motor.buscarVendasParaCalculo.mock.calls,
      ...lucro.gerarLucroPorProduto.mock.calls,
      ...faturamento.calcularFaturamentoComFrete.mock.calls,
      ...reposicao.calcularReposicaoConta.mock.calls,
      ...reposicao.calcularCapitalParadoConta.mock.calls,
      ...pendencias.calcularTodasPendencias.mock.calls,
      ...saude.calcularSaudeAnuncios.mock.calls,
      ...lista.listarProdutos.mock.calls,
      ...diagnostico.gerarDiagnostico.mock.calls,
    ] as unknown[][];
    expect(chamadas.length).toBeGreaterThan(0);
    for (const chamada of chamadas) expect(chamada[0]).toBe("conta-a");
    for (const chamada of [...prismaMock.produto.findFirst.mock.calls, ...prismaMock.vendaCanalItem.findMany.mock.calls]) {
      expect(JSON.stringify(chamada)).toContain("conta-a");
      expect(JSON.stringify(chamada)).not.toContain("conta-b");
    }
    expect(r.conteudo.startsWith("<dados_da_loja>")).toBe(true);
  });
});

describe("filtro de custo sem VER_CUSTO", () => {
  it("quem não vê custo nunca recebe custo, valor de compra, margem ou valor em risco", async () => {
    for (const nome of ["sugestao_reposicao", "buscar_produtos", "detalhe_produto", "diagnostico_loja"]) {
      const r = await executarFerramenta(nome, ENTRADAS[nome], estoque);
      expect(r.erro, nome).toBe(false);
      expect(r.conteudo, nome).not.toMatch(/custo(Medio|TotalCompra)|cmv|margem|lucro|valorEmRisco|1200(\.0)?[,}]/i);
    }
  });

  it("quem vê custo recebe os valores em reais", async () => {
    const r = await executarFerramenta("sugestao_reposicao", {}, admin);
    const saida = dados(r.conteudo);
    expect(saida.itens[0].custoTotalCompra).toBe(1200);
    expect(saida.resumo.custoTotalCompraCriticos).toBe(1200);
    expect(saida.fonte).toBe("Reposição");
  });

  it("ranking por margem cai para faturamento quando o papel não vê custo", async () => {
    const compras = montarContextoFerramenta({ id: "u", contaId: "conta-a", role: "ADMIN" }, agora);
    await executarFerramenta("vendas_por_produto", { ordem: "margem" }, { ...compras, podeVerCusto: false });
    expect(lucro.gerarLucroPorProduto).toHaveBeenLastCalledWith("conta-a", expect.anything(), "faturamentoBruto");
  });
});

describe("saída das ferramentas", () => {
  it("converte centavos para reais e datas para AAAA-MM-DD", async () => {
    const r = await executarFerramenta("resumo_financeiro", { periodo: "mes_atual" }, admin);
    const saida = dados(r.conteudo);
    expect(saida).toMatchObject({ fonte: "Financeiro", faturamento: 1000, ticketMedio: 100, margemContribuicaoPercentual: 31 });
    expect(saida.periodo).toEqual({ rotulo: "Mês atual", desde: "2026-11-01", ate: "2026-11-20" });
  });

  it("mede dinheiro em jogo nos anúncios com o faturamento de 30 dias", async () => {
    const r = await executarFerramenta("saude_anuncios", {}, admin);
    expect(dados(r.conteudo).grupos[0]).toMatchObject({ faturamento30dEmJogo: 100, exemplos: [{ mlItemId: "MLB1", faturamento30d: 100 }] });
  });

  it("remove e-mail de qualquer texto antes de mandar ao modelo", async () => {
    const r = await executarFerramenta("diagnostico_loja", {}, admin);
    expect(r.conteudo).not.toContain("joao@exemplo.com");
  });

  it("corta listas longas", async () => {
    const dias = new Map(
      Array.from({ length: 400 }, (_, i) => [
        `2025-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}-${i}`,
        { pedidos: 1, unidades: 1, receitaTotal: 1000, margemContribuicaoVendas: 100 },
      ])
    );
    motor.agruparVendas.mockReturnValueOnce(dias);
    const r = await executarFerramenta("vendas_por_dia", { desde: "2025-01-01", ate: "2026-01-31" }, admin);
    const saida = dados(r.conteudo);
    expect(saida.dias.cortado).toBe(true);
    expect(saida.dias.totalItens).toBe(400);
    expect(r.conteudo.length).toBeLessThanOrEqual(12100);
  });

  it("entrada inválida e erro interno viram erro de ferramenta curto", async () => {
    const invalida = await executarFerramenta("buscar_produtos", { termo: "" }, admin);
    expect(invalida.erro).toBe(true);
    expect(invalida.conteudo).toContain("Entrada inválida");

    const silencio = vi.spyOn(console, "error").mockImplementation(() => undefined);
    reposicao.calcularReposicaoConta.mockRejectedValueOnce(new Error("timeout do banco com dados sensíveis"));
    const falha = await executarFerramenta("sugestao_reposicao", {}, admin);
    expect(falha.erro).toBe(true);
    expect(falha.conteudo).not.toContain("dados sensíveis");
    expect(JSON.stringify(silencio.mock.calls)).not.toContain("dados sensíveis");
    silencio.mockRestore();

    const semProduto = await executarFerramenta("detalhe_produto", {}, admin);
    expect(semProduto.erro).toBe(true);
  });

  it("período personalizado inválido vira erro legível", async () => {
    const r = await executarFerramenta("resumo_financeiro", { desde: "2026-11-10", ate: "2026-11-01" }, admin);
    expect(r).toMatchObject({ erro: true, conteudo: "A data final é anterior à inicial." });
  });
});
