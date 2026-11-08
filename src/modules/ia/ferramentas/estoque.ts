import { z } from "zod";
import { normalizarTexto } from "@/modules/catalogo/listaProdutos";
import {
  calcularCapitalParadoConta,
  calcularReposicaoConta,
  type SugestaoReposicao,
} from "@/services/reposicaoService";
import { definirFerramenta, reais, reaisOuZero } from "./tipos";

const ORDEM_STATUS: Record<SugestaoReposicao["status"], number> = { critico: 0, atencao: 1, ok: 2 };

export function linhaReposicao(s: SugestaoReposicao) {
  return {
    produtoId: s.produtoId,
    nome: s.nome,
    sku: s.sku,
    status: s.status,
    ehKit: s.ehKit,
    demandaDiaria: Math.round(s.demandaDiaria * 100) / 100,
    estoqueLocal: s.estoqueLocal,
    estoqueFullDisponivel: s.estoqueFullDisponivel,
    estoqueFullEmTransito: s.estoqueFullEmTransito,
    pedidosDeCompraEmAberto: s.pedidosEmAbertoUnidades,
    estoqueEmKits: s.estoqueEmKitsUnidades,
    estoqueDisponivelTotal: s.estoqueDisponivel,
    coberturaDias: s.coberturaDias === null ? null : Math.round(s.coberturaDias),
    coberturaDiasLocal: s.coberturaDiasLocal === null ? null : Math.round(s.coberturaDiasLocal),
    coberturaDiasFull: s.coberturaDiasFull === null ? null : Math.round(s.coberturaDiasFull),
    dataRupturaPrevista: s.dataRupturaPrevista,
    prazoEntregaDias: s.leadTimeDias,
    pontoPedido: Math.ceil(s.pontoPedido),
    comprarUnidades: s.quantidadeSugeridaCompraUnidades,
    comprarCaixas: s.quantidadeSugeridaCompraCaixas,
    enviarParaFull: s.quantidadeSugeridaEnvioFull,
    custoTotalCompra: reais(s.custoTotalCompra),
    fornecedor: s.fornecedorPrincipalNome,
  };
}

export const sugestaoReposicao = definirFerramenta({
  nome: "sugestao_reposicao",
  rotulo: "Consultando a reposição",
  descricao:
    "Sugestão de compra e de envio ao Full da tela Reposição: demanda diária (vendas pagas do ML + saídas manuais, kits explodidos), estoque local + Full + em trânsito + pedidos de compra em aberto, cobertura em dias, data prevista de ruptura, prazo do fornecedor e quanto comprar. Use para 'o que preciso comprar', 'o que vai acabar' e 'o que mandar pro Full'.",
  esquema: z.object({
    urgencia: z
      .enum(["critico", "atencao", "todos"])
      .default("todos")
      .describe("critico = acaba antes da próxima compra chegar; atencao = perto do ponto de pedido; todos = os dois."),
    fornecedor: z.string().max(80).optional().describe("Filtra pelo nome do fornecedor principal."),
    limite: z.number().int().min(1).max(30).default(15).describe("Quantos produtos devolver (máx. 30)."),
  }),
  permissao: "PEDIDOS_COMPRA_VER",
  async executar(contexto, entrada) {
    const { sugestoes, parcial } = await calcularReposicaoConta(contexto.contaId);
    const termoFornecedor = entrada.fornecedor ? normalizarTexto(entrada.fornecedor) : null;
    const filtradas = sugestoes
      .filter((s) => (entrada.urgencia === "todos" ? s.status !== "ok" : s.status === entrada.urgencia))
      .filter((s) => !termoFornecedor || normalizarTexto(s.fornecedorPrincipalNome ?? "").includes(termoFornecedor))
      .sort(
        (a, b) =>
          ORDEM_STATUS[a.status] - ORDEM_STATUS[b.status] ||
          (a.coberturaDias ?? Number.POSITIVE_INFINITY) - (b.coberturaDias ?? Number.POSITIVE_INFINITY) ||
          b.demandaDiaria - a.demandaDiaria
      );
    const criticos = sugestoes.filter((s) => s.status === "critico");

    return {
      fonte: "Reposição",
      parcial,
      resumo: {
        criticos: criticos.length,
        atencao: sugestoes.filter((s) => s.status === "atencao").length,
        ok: sugestoes.filter((s) => s.status === "ok").length,
        unidadesParaComprarNosCriticos: criticos.reduce((t, s) => t + s.quantidadeSugeridaCompraUnidades, 0),
        custoTotalCompraCriticos: reaisOuZero(criticos.reduce((t, s) => t + (s.custoTotalCompra ?? 0), 0)),
      },
      totalFiltrado: filtradas.length,
      itens: filtradas.slice(0, entrada.limite).map(linhaReposicao),
    };
  },
});

export const capitalParado = definirFerramenta({
  nome: "capital_parado",
  rotulo: "Calculando o capital parado",
  descricao:
    "Produtos com estoque local e sem venda há muitos dias, com o valor parado pelo custo médio. Use para 'o que está encalhado', 'onde tenho dinheiro parado' ou para sugerir promoção/queima.",
  esquema: z.object({
    diasSemVenda: z.number().int().min(30).max(365).default(90).describe("Mínimo de dias sem venda."),
    limite: z.number().int().min(1).max(30).default(10).describe("Quantos produtos devolver."),
  }),
  permissao: "VER_CUSTO",
  async executar(contexto, entrada) {
    const parados = await calcularCapitalParadoConta(contexto.contaId, entrada.diasSemVenda);
    return {
      fonte: "Central de controle (Capital parado) e Reposição",
      diasSemVenda: entrada.diasSemVenda,
      totalProdutos: parados.length,
      valorParadoTotal: reaisOuZero(parados.reduce((t, p) => t + (p.valorParado ?? 0), 0)),
      produtosSemCusto: parados.filter((p) => p.valorParado === null).length,
      itens: parados.slice(0, entrada.limite).map((p) => ({
        produtoId: p.produtoId,
        nome: p.nome,
        sku: p.sku,
        estoqueLocal: p.estoqueLocal,
        valorParado: reais(p.valorParado),
        diasSemVenda: p.diasSemVenda,
        ultimaVenda: p.ultimaVenda,
      })),
    };
  },
});
