import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("../acesso", () => ({ garantirAcessoIa: vi.fn(async () => ({ liberada: true, ilimitada: false })) }));
const registrarUsoIa = vi.fn(async () => undefined);
vi.mock("../uso", () => ({ registrarUsoIa }));
const cobrarUsoIa = vi.fn(async () => ({ debitado: 0, saldoAntes: 5, saldoApos: 5, repetido: false, custo: 0 }));
vi.mock("../consumo", () => ({ cobrarUsoIa }));
const estornarCreditos = vi.fn(async () => 0);
vi.mock("../creditos", async (importOriginal) => ({ ...(await importOriginal<typeof import("../creditos")>()), estornarCreditos }));

const sugestao = {
  produtoId: "p1",
  nome: "Borrifador",
  sku: "SKU1",
  custoMedio: 4000,
  estoqueLocal: 2,
  estoqueFullDisponivel: 5,
  estoqueFullEmTransito: 0,
  estoqueFullIndisponivel: 0,
  pedidosEmAbertoUnidades: 0,
  estoqueEmKitsUnidades: 0,
  temAnuncioFull: true,
  ehKit: false,
  demandaDiaria: 1.5,
  leadTimeDias: 10,
  estoqueDisponivel: 7,
  pontoPedido: 20,
  coberturaDias: 4.6,
  coberturaDiasLocal: 1.3,
  coberturaDiasFull: 3.3,
  dataRupturaPrevista: "2026-11-24",
  quantidadeSugeridaCompraUnidades: 30,
  quantidadeSugeridaCompraCaixas: 3,
  quantidadeSugeridaEnvioFull: 0,
  custoTotalCompra: 120000,
  custoIndefinido: false,
  fornecedorPrincipalId: "f1",
  fornecedorPrincipalNome: "Alfa",
  status: "critico",
};
const calcularReposicaoConta = vi.fn(async () => ({ sugestoes: [sugestao], parcial: false }));
vi.mock("@/services/reposicaoService", () => ({ calcularReposicaoConta, calcularCapitalParadoConta: vi.fn() }));

const executarFerramenta = vi.fn(async (nome: string) => ({
  nome,
  rotulo: nome,
  entrada: {},
  conteudo: `<dados_da_loja>\n{"fonte":"x"}\n</dados_da_loja>`,
  erro: false,
  duracaoMs: 1,
}));
vi.mock("../ferramentas/registro", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../ferramentas/registro")>()),
  executarFerramenta,
}));

const { explicarReposicao, explicarVariacao, planejarAnuncios, resumirProduto } = await import("../explicacoes");

function provedor(texto: string) {
  return {
    criarMensagem: vi.fn(async () => ({ content: [{ type: "text", text: texto }], usage: { input_tokens: 50, output_tokens: 30 } })),
    transmitirMensagem: vi.fn(),
  };
}

const admin = { id: "u1", contaId: "conta-exp", role: "ADMIN" as const };
const agora = new Date("2026-11-20T15:00:00Z");

beforeEach(() => vi.clearAllMocks());

describe("explicarReposicao", () => {
  it("usa o modelo rápido com a linha da própria Reposição e guarda em cache no dia", async () => {
    const p = provedor("A demanda é de 1,5 por dia e o estoque cobre 4 dias, menos que o prazo de 10 dias.");
    const r = await explicarReposicao(admin, "p1", p as never, agora);
    expect(r).toMatchObject({ tipo: "reposicao", texto: expect.stringContaining("1,5 por dia") });
    const parametros = (p.criarMensagem.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(parametros).toMatchObject({ modelo: "claude-haiku-5-5", recurso: "EXPLICACAO" });
    const dados = String((parametros.mensagens as Array<{ content: string }>)[0].content);
    expect(dados).toContain("<dados_da_loja>");
    expect(dados).toContain('"demandaDiaria":1.5');
    expect(dados).toContain('"custoTotalCompra":1200');

    await explicarReposicao(admin, "p1", p as never, agora);
    expect(p.criarMensagem).toHaveBeenCalledTimes(1);
    expect(registrarUsoIa).toHaveBeenCalledTimes(1);
  });

  it("perfil sem custo tem cache separado e não recebe custo", async () => {
    const p = provedor("Explicação sem custo.");
    await explicarReposicao({ id: "u2", contaId: "conta-exp", role: "ESTOQUE" }, "p1", p as never, agora);
    expect(p.criarMensagem).toHaveBeenCalledTimes(1);
    const dados = String(((p.criarMensagem.mock.calls[0] as unknown as [Record<string, unknown>])[0].mensagens as Array<{ content: string }>)[0].content);
    expect(dados).not.toContain("custo");
  });

  it("exige permissão de ver a Reposição", async () => {
    await expect(explicarReposicao({ id: "u3", contaId: "c", role: "VENDAS" }, "p1", provedor("x") as never, agora)).rejects.toThrow();
  });

  it("produto fora da Reposição vira erro de ferramenta", async () => {
    await expect(explicarReposicao(admin, "nao-existe", provedor("x") as never, agora)).rejects.toThrow("não está na Reposição");
  });
});

describe("explicações estruturadas", () => {
  it("explicar variação compara períodos e devolve 3 motivos", async () => {
    const p = provedor(
      JSON.stringify({
        resumo: "A margem caiu 4 pontos.",
        motivos: [
          { titulo: "Frete subiu", detalhe: "R$ 800 a mais" },
          { titulo: "Ads", detalhe: "R$ 300 a mais" },
          { titulo: "Mix", detalhe: "Menos venda do Borrifador" },
          { titulo: "Extra", detalhe: "cortado" },
        ],
      })
    );
    const r = await explicarVariacao(admin, "mes-atual", p as never, agora);
    expect(executarFerramenta).toHaveBeenCalledWith("comparar_periodos", { atual: { periodo: "mes_atual" } }, expect.objectContaining({ contaId: "conta-exp" }));
    expect(r).toMatchObject({ tipo: "variacao", resumo: "A margem caiu 4 pontos." });
    expect((r as { motivos: unknown[] }).motivos).toHaveLength(3);
    const parametros = (p.criarMensagem.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(parametros.modelo).toBe("claude-sonnet-5-5");
    expect(parametros.formato).toMatchObject({ type: "object", required: ["resumo", "motivos"] });
  });

  it("explicar variação é só para quem vê o Financeiro", async () => {
    await expect(explicarVariacao({ id: "u", contaId: "c2", role: "COMPRAS" }, "7", provedor("{}") as never, agora)).rejects.toThrow();
  });

  it("plano de anúncios normaliza o impacto e limita a 5 ações", async () => {
    const p = provedor(
      JSON.stringify({
        resumo: "R$ 2 mil em jogo.",
        acoes: Array.from({ length: 7 }, (_, i) => ({ titulo: `A${i}`, detalhe: "d", impacto: i === 0 ? "alto" : "enorme" })),
      })
    );
    const r = (await planejarAnuncios({ id: "u", contaId: "conta-anuncios", role: "VENDAS" }, p as never, agora)) as {
      acoes: Array<{ impacto: string }>;
    };
    expect(r.acoes).toHaveLength(5);
    expect(r.acoes[0].impacto).toBe("alto");
    expect(r.acoes[1].impacto).toBe("medio");
  });

  it("resumo do produto usa a ficha do produto e erro de ferramenta não chama a IA", async () => {
    executarFerramenta.mockResolvedValueOnce({ nome: "detalhe_produto", rotulo: "", entrada: {}, conteudo: "Produto não encontrado", erro: true, duracaoMs: 1 });
    const p = provedor("x");
    await expect(resumirProduto(admin, "p-inexistente", p as never, agora)).rejects.toThrow("Produto não encontrado");
    expect(p.criarMensagem).not.toHaveBeenCalled();
  });
});
