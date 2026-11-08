import { ArmazemTipo, StatusVendaCanal } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { listarProdutos } from "@/modules/catalogo/listaProdutos";
import { gerarDiagnostico } from "@/modules/controle/diagnostico";
import { gerarLucroPorProduto } from "@/modules/financeiro/relatorios/lucroPorProduto";
import { calcularTodasPendencias } from "@/services/pendenciasService";
import { calcularReposicaoConta } from "@/services/reposicaoService";
import { calcularSaudeAnuncios } from "@/services/saudeAnunciosService";
import { podeVer } from "@/lib/permissoes";
import { linhaReposicao } from "./estoque";
import { ErroFerramenta, definirFerramenta, percentual, reais, reaisOuZero } from "./tipos";

const DIA_MS = 24 * 60 * 60 * 1000;
const VENDAS_VALIDAS = [StatusVendaCanal.PAGA, StatusVendaCanal.DEVOLVIDA_PARCIAL, StatusVendaCanal.EM_MEDIACAO];

const CODIGOS_PENDENCIA = [
  "SEM_CUSTO",
  "SEM_FORNECEDOR",
  "SEM_FORNECEDOR_PRINCIPAL",
  "SEM_PRAZO_FORNECEDOR",
  "SEM_PRECO",
  "SEM_EAN",
  "SEM_VINCULO_ML",
  "SEM_TARIFA",
  "SEM_FRETE",
  "MARGEM_NEGATIVA",
  "ESTOQUE_DIVERGENTE",
  "VENDA_INCOMPLETA",
] as const;

export const pendenciasCadastro = definirFerramenta({
  nome: "pendencias_cadastro",
  rotulo: "Verificando o cadastro",
  descricao:
    "Pendências de cadastro dos produtos ativos (sem custo, sem fornecedor, sem preço, sem EAN, sem vínculo com anúncio, margem negativa, estoque diferente do Bling…), agrupadas por tipo com exemplos. Use para 'o que falta arrumar no cadastro' ou para explicar por que um número pode estar errado.",
  esquema: z.object({
    tipo: z.enum(CODIGOS_PENDENCIA).optional().describe("Filtra um tipo de pendência e traz mais exemplos."),
  }),
  permissao: null,
  async executar(contexto, entrada) {
    const itens = await calcularTodasPendencias(contexto.contaId);
    const porCodigo = new Map<string, { severidade: string; mensagem: string; acao: string; produtos: Array<{ nome: string; sku: string }> }>();
    for (const item of itens) {
      for (const p of item.pendencias) {
        if (entrada.tipo && p.codigo !== entrada.tipo) continue;
        const grupo = porCodigo.get(p.codigo) ?? { severidade: p.severidade, mensagem: p.mensagem, acao: p.acao, produtos: [] };
        grupo.produtos.push({ nome: item.nome, sku: item.sku });
        porCodigo.set(p.codigo, grupo);
      }
    }
    const exemplos = entrada.tipo ? 20 : 5;
    return {
      fonte: "Produtos (filtro de pendências)",
      produtosComPendencia: itens.filter((i) => i.pendencias.length > 0).length,
      porTipo: [...porCodigo.entries()]
        .sort(([, a], [, b]) => b.produtos.length - a.produtos.length)
        .map(([codigo, g]) => ({
          codigo,
          severidade: g.severidade,
          descricao: g.mensagem,
          acao: g.acao,
          quantidade: g.produtos.length,
          exemplos: g.produtos.slice(0, exemplos),
          tela: `/produtos?pendencia=${codigo}`,
        })),
    };
  },
});

async function faturamento30dPorAnuncio(contaId: string, anuncios: string[], agora: Date) {
  if (anuncios.length === 0) return new Map<string, { unidades: number; faturamento: number }>();
  const itens = await prisma.vendaCanalItem.findMany({
    where: {
      anuncioExternoId: { in: anuncios },
      venda: { userId: contaId, dataVenda: { gte: new Date(agora.getTime() - 30 * DIA_MS) }, status: { in: VENDAS_VALIDAS } },
    },
    select: { anuncioExternoId: true, quantidade: true, precoUnitario: true },
  });
  const mapa = new Map<string, { unidades: number; faturamento: number }>();
  for (const item of itens) {
    const atual = mapa.get(item.anuncioExternoId) ?? { unidades: 0, faturamento: 0 };
    atual.unidades += item.quantidade;
    atual.faturamento += item.quantidade * item.precoUnitario;
    mapa.set(item.anuncioExternoId, atual);
  }
  return mapa;
}

export const saudeAnuncios = definirFerramenta({
  nome: "saude_anuncios",
  rotulo: "Checando os anúncios",
  descricao:
    "Problemas dos anúncios do Mercado Livre (pausados, sem estoque, sem vínculo com produto, Full baixo, sem tarifa/frete sincronizados, preço abaixo do custo), com o faturamento dos últimos 30 dias de cada anúncio para medir o dinheiro em jogo. Use para 'quais anúncios estão perdendo venda' e para priorizar correções.",
  esquema: z.object({
    categoria: z
      .enum(["PAUSADO", "SEM_ESTOQUE", "SEM_VINCULO", "FULL_BAIXO", "SEM_TARIFA_FRETE", "PRECO_ABAIXO_CUSTO"])
      .optional()
      .describe("Filtra um tipo de problema."),
  }),
  permissao: "VENDAS_ML_VER",
  async executar(contexto, entrada) {
    const saude = await calcularSaudeAnuncios(contexto.contaId);
    const grupos = saude.grupos.filter((g) => g.anuncios.length > 0 && (!entrada.categoria || g.categoria === entrada.categoria));
    const vendas = await faturamento30dPorAnuncio(
      contexto.contaId,
      [...new Set(grupos.flatMap((g) => g.anuncios.map((a) => a.mlItemId)))],
      contexto.agora
    );

    return {
      fonte: "Anúncios (Saúde dos anúncios)",
      anunciosAtivos: saude.totalAtivos,
      grupos: grupos.map((g) => {
        const anuncios = g.anuncios
          .map((a) => ({
            mlItemId: a.mlItemId,
            titulo: a.mlTitle,
            produtoSku: a.produtoSku,
            unidades30d: vendas.get(a.mlItemId)?.unidades ?? 0,
            faturamento30d: reaisOuZero(vendas.get(a.mlItemId)?.faturamento ?? 0),
          }))
          .sort((a, b) => b.faturamento30d - a.faturamento30d);
        return {
          categoria: g.categoria,
          titulo: g.titulo,
          descricao: g.descricao,
          acao: g.acao,
          tela: g.linkFiltro,
          quantidade: g.anuncios.length,
          faturamento30dEmJogo: Math.round(anuncios.reduce((t, a) => t + a.faturamento30d, 0) * 100) / 100,
          exemplos: anuncios.slice(0, entrada.categoria ? 20 : 8),
        };
      }),
    };
  },
});

export const buscarProdutos = definirFerramenta({
  nome: "buscar_produtos",
  rotulo: "Procurando produtos",
  descricao:
    "Busca produtos e kits do catálogo por nome, SKU ou EAN (mesma busca da tela Produtos) e traz estoque local, Full, vendas em 90 dias, anúncios e pendências. Use para achar o produtoId antes de pedir o detalhe.",
  esquema: z.object({
    termo: z.string().min(1).max(80).describe("Nome, SKU ou EAN."),
    limite: z.number().int().min(1).max(10).default(5),
  }),
  permissao: null,
  async executar(contexto, entrada) {
    const resultado = await listarProdutos(contexto.contaId, {
      q: entrada.termo,
      status: "todos",
      tipo: "todos",
      porPagina: Math.max(5, entrada.limite),
      pagina: 1,
    });
    return {
      fonte: "Produtos",
      total: resultado.total,
      itens: resultado.itens.slice(0, entrada.limite).map((p) => ({
        produtoId: p.id,
        nome: p.nome,
        sku: p.sku,
        ean: p.codigoEAN,
        kit: p.isKit,
        ativo: p.ativo,
        estoqueLocal: p.estoqueLocal,
        estoqueFull: p.estoqueFull,
        vendas90d: p.vendas90d,
        anuncios: p.anuncios,
        fornecedor: p.fornecedorPrincipal?.nome ?? null,
        custoMedio: reais(p.custoMedio),
        pendencias: p.pendencias.map((x) => x.codigo),
      })),
    };
  },
});

export async function lerDetalheProduto(
  contexto: { contaId: string; agora: Date },
  entrada: { produtoId?: string; sku?: string }
) {
  const produto = await prisma.produto.findFirst({
    where: {
      userId: contexto.contaId,
      ...(entrada.produtoId ? { id: entrada.produtoId } : { sku: { equals: entrada.sku!, mode: "insensitive" } }),
    },
    select: {
      id: true,
      nome: true,
      sku: true,
      ean: true,
      isKit: true,
      ativo: true,
      custoMedio: true,
      custoOrigem: true,
      precoVenda: true,
      estoques: { select: { quantidade: true, armazem: { select: { nome: true, tipo: true } } } },
      componentes: { select: { quantidade: true, produto: { select: { nome: true, sku: true } } } },
      fornecedores: {
        where: { principal: true },
        select: { prazoEntregaDias: true, fornecedor: { select: { nome: true } } },
      },
      ProdutoMercadoLivre: {
        select: {
          mlItemId: true,
          mlTitle: true,
          mlStatus: true,
          mlPrice: true,
          mlAvailableQuantity: true,
          mlLogisticType: true,
          mlFullDisponivel: true,
          mlFullEmTransito: true,
          mlTarifaVenda: true,
          mlCustoFrete: true,
        },
      },
    },
  });
  if (!produto) throw new ErroFerramenta("Produto não encontrado nesta conta. Use buscar_produtos para achar o id ou o SKU.");

  const desde90 = new Date(contexto.agora.getTime() - 90 * DIA_MS);
  const desde30 = new Date(contexto.agora.getTime() - 30 * DIA_MS);
  const [linhas30, linhas90, reposicao, pendencias] = await Promise.all([
    gerarLucroPorProduto(contexto.contaId, { desde: desde30, ate: contexto.agora }),
    gerarLucroPorProduto(contexto.contaId, { desde: desde90, ate: contexto.agora }),
    calcularReposicaoConta(contexto.contaId),
    calcularTodasPendencias(contexto.contaId),
  ]);
  const vendas = (linhas: typeof linhas30) => {
    const linha = linhas.find((l) => l.produtoId === produto.id);
    return {
      unidades: linha?.unidades ?? 0,
      faturamento: reaisOuZero(linha?.faturamentoBruto),
      margemContribuicao: reaisOuZero(linha?.margemContribuicao),
      margemContribuicaoPercentual: percentual(linha?.margemContribuicaoPercentual),
      curvaAbc: linha?.curvaAbc ?? null,
    };
  };
  const somaEstoque = (tipo: ArmazemTipo) =>
    produto.estoques.filter((e) => e.armazem.tipo === tipo).reduce((t, e) => t + e.quantidade, 0);
  const sugestao = reposicao.sugestoes.find((s) => s.produtoId === produto.id);
  const fornecedor = produto.fornecedores[0];

  return {
    fonte: "Produtos → ficha do produto",
    produto: {
      produtoId: produto.id,
      nome: produto.nome,
      sku: produto.sku,
      ean: produto.ean === null ? null : produto.ean.toString(),
      kit: produto.isKit,
      ativo: produto.ativo,
      custoMedio: reais(produto.custoMedio),
      origemDoCusto: produto.custoOrigem,
      precoVenda: reais(produto.precoVenda),
      tela: `/produtos/${produto.id}`,
    },
    estoque: {
      local: somaEstoque(ArmazemTipo.LOCAL),
      fullDisponivel: produto.ProdutoMercadoLivre.reduce((t, a) => t + (a.mlFullDisponivel ?? 0), 0),
      fullEmTransito: produto.ProdutoMercadoLivre.reduce((t, a) => t + (a.mlFullEmTransito ?? 0), 0),
      porArmazem: produto.estoques.map((e) => ({ armazem: e.armazem.nome, tipo: e.armazem.tipo, quantidade: e.quantidade })),
    },
    componentesDoKit: produto.componentes.map((c) => ({ nome: c.produto.nome, sku: c.produto.sku, quantidade: c.quantidade })),
    fornecedorPrincipal: fornecedor ? { nome: fornecedor.fornecedor.nome, prazoEntregaDias: fornecedor.prazoEntregaDias } : null,
    anuncios: produto.ProdutoMercadoLivre.map((a) => ({
      mlItemId: a.mlItemId,
      titulo: a.mlTitle,
      status: a.mlStatus,
      preco: reais(a.mlPrice),
      disponivelNoMl: a.mlAvailableQuantity,
      logistica: a.mlLogisticType,
      tarifaVenda: reais(a.mlTarifaVenda),
      custoFrete: reais(a.mlCustoFrete),
    })),
    vendas: { ultimos30Dias: vendas(linhas30), ultimos90Dias: vendas(linhas90) },
    reposicao: sugestao ? linhaReposicao(sugestao) : null,
    pendencias: (pendencias.find((p) => p.produtoId === produto.id)?.pendencias ?? []).map((p) => ({
      codigo: p.codigo,
      descricao: p.mensagem,
    })),
  };
}

export const detalheProduto = definirFerramenta({
  nome: "detalhe_produto",
  rotulo: "Abrindo a ficha do produto",
  descricao:
    "Ficha completa de um produto: estoque local e Full, kit, fornecedor, anúncios vinculados, vendas e margem em 30 e 90 dias, sugestão de reposição e pendências. Precisa do produtoId ou do SKU (se não souber, use buscar_produtos antes).",
  esquema: z
    .object({
      produtoId: z.string().max(64).optional(),
      sku: z.string().max(80).optional(),
    })
    .refine((e) => Boolean(e.produtoId || e.sku), { message: "Informe produtoId ou sku." }),
  permissao: null,
  async executar(contexto, entrada) {
    const detalhe = await lerDetalheProduto(contexto, entrada);
    if (!podeVer(contexto.papel, "FINANCEIRO_VER")) {
      return {
        ...detalhe,
        vendas: {
          ultimos30Dias: { unidades: detalhe.vendas.ultimos30Dias.unidades },
          ultimos90Dias: { unidades: detalhe.vendas.ultimos90Dias.unidades },
          aviso: "Valores em reais das vendas exigem acesso ao Financeiro.",
        },
      };
    }
    return detalhe;
  },
});

export const diagnosticoLoja = definirFerramenta({
  nome: "diagnostico_loja",
  rotulo: "Lendo a Central de controle",
  descricao:
    "Diagnóstico geral da loja (Central de controle): nota de 0 a 100, nota por área (integrações, estoque, cadastro, anúncios, financeiro) e a lista priorizada de problemas com a tela onde resolver. Use para perguntas abertas como 'como está minha loja' ou 'por onde começo'.",
  esquema: z.object({}),
  permissao: null,
  async executar(contexto) {
    const d = await gerarDiagnostico(contexto.contaId);
    return {
      fonte: "Central de controle",
      nota: d.nota,
      classificacao: d.classificacao,
      areas: d.areas.map((a) => ({ area: a.titulo, nota: a.nota, problemas: a.problemas })),
      contexto: d.contexto,
      areasIncompletas: d.incompleto,
      problemas: d.itens.map((i) => ({
        id: i.id,
        area: i.area,
        gravidade: i.gravidade,
        titulo: i.titulo,
        descricao: i.descricao,
        quantidade: i.quantidade,
        valorEmRisco: reais(i.valorEmRisco),
        acao: i.acao.rotulo,
        tela: i.acao.href,
        exemplos: i.exemplos.slice(0, 5),
      })),
    };
  },
});
