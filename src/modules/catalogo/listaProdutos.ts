import { ArmazemTipo, CanalVenda, Prisma, StatusVendaCanal } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { withCache, createCacheKey } from "@/lib/cache";
import { calcularTodasPendencias } from "@/services/pendenciasService";
import type { Pendencia } from "@/lib/pendencias";

/**
 * Lista de produtos da tela Produtos, paginada no servidor.
 *
 * Ordem padrão ("relevancia"): ativos primeiro → mais vendidos em 90 dias
 * (contando as vendas dos kits que usam o produto) → com estoque → nome.
 * Assim a primeira página já mostra o que importa e o resto carrega
 * conforme a rolagem — operação com milhares de SKUs não baixa tudo de uma vez.
 *
 * Tudo que a linha precisa (estoque local, Full, vendas, pendências) vem
 * daqui numa chamada só; a tela não faz mais um fetch por linha.
 */

export type FiltroStatus = "ativos" | "inativos" | "todos";
export type FiltroTipo = "produtos" | "kits" | "todos";
export type FiltroEstoque = "all" | "available" | "low" | "none";
export type FiltroMl = "all" | "linked" | "unlinked";
export type OrdemLista = "relevancia" | "nome" | "estoque" | "vendas";

export interface FiltrosListaProdutos {
  q?: string;
  status?: FiltroStatus;
  tipo?: FiltroTipo;
  estoque?: FiltroEstoque;
  ml?: FiltroMl;
  fornecedorId?: string;
  pendencia?: string;
  ordem?: OrdemLista;
  pagina?: number;
  porPagina?: number;
}

export interface ItemListaProduto {
  id: string;
  nome: string;
  sku: string;
  codigoEAN: string | null;
  isKit: boolean;
  ativo: boolean;
  imagemUrl: string | null;
  custoMedio: number | null;
  fornecedorPrincipal: { id: string; nome: string; prazoEntregaDias: number | null } | null;
  estoqueLocal: number;
  estoqueSeguranca: number;
  estoqueFull: number;
  vendas90d: number;
  anuncios: number;
  componentes: Array<{ produtoId: string; nome: string; sku: string; quantidade: number }>;
  /** Kits: quantos kits dá para montar com o estoque local dos componentes. */
  kitsMontaveis: number | null;
  pendencias: Pendencia[];
  // Campos legados que ProdutoTableRow/diálogos ainda leem.
  _estoqueLocalTotal: number;
  _mlEstoqueFull: number;
  _mlTotalVendas: number;
  _vinculadoML: boolean;
}

export interface ResultadoListaProdutos {
  itens: ItemListaProduto[];
  total: number;
  pagina: number;
  porPagina: number;
  temMais: boolean;
  contagens: { produtos: number; kits: number; inativos: number };
  fornecedores: Array<{ id: string; nome: string }>;
  pendenciasPorCodigo: Record<string, number>;
}

const NOVENTA_DIAS_MS = 90 * 24 * 60 * 60 * 1000;
const STATUS_VENDA_VALIDOS: StatusVendaCanal[] = [
  StatusVendaCanal.PAGA,
  StatusVendaCanal.DEVOLVIDA_PARCIAL,
  StatusVendaCanal.EM_MEDIACAO,
];

const SELECT_LISTA = {
  id: true,
  nome: true,
  sku: true,
  ean: true,
  isKit: true,
  ativo: true,
  custoMedio: true,
  imagemUrl: true,
  estoques: {
    select: { quantidade: true, estoqueSeguranca: true, armazem: { select: { tipo: true } } },
  },
  fornecedores: {
    orderBy: { principal: "desc" as const },
    take: 1,
    select: { prazoEntregaDias: true, fornecedor: { select: { id: true, nome: true } } },
  },
  ProdutoMercadoLivre: {
    select: {
      mlSold90Days: true,
      mlLogisticType: true,
      mlShippingMode: true,
      mlFullDisponivel: true,
      mlStatus: true,
      mlThumbnail: true,
    },
  },
  componentes: {
    select: {
      quantidade: true,
      produto: { select: { id: true, nome: true, sku: true, custoMedio: true } },
    },
  },
} satisfies Prisma.ProdutoSelect;

type LinhaProduto = Prisma.ProdutoGetPayload<{ select: typeof SELECT_LISTA }>;

export function normalizarTexto(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

async function vendasPorProduto90d(contaId: string): Promise<Map<string, number> | null> {
  const desde = new Date(Date.now() - NOVENTA_DIAS_MS);
  const grupos = await prisma.vendaCanalItem.groupBy({
    by: ["produtoId"],
    where: {
      produtoId: { not: null },
      venda: {
        userId: contaId,
        canal: CanalVenda.MERCADO_LIVRE,
        status: { in: STATUS_VENDA_VALIDOS },
        dataVenda: { gte: desde },
      },
    },
    _sum: { quantidade: true },
  });
  if (grupos.length === 0) return null;
  return new Map(grupos.map((g) => [g.produtoId as string, g._sum.quantidade ?? 0]));
}

export async function listarProdutos(
  contaId: string,
  filtros: FiltrosListaProdutos
): Promise<ResultadoListaProdutos> {
  const porPagina = Math.min(100, Math.max(5, filtros.porPagina ?? 30));
  const pagina = Math.max(1, filtros.pagina ?? 1);
  const status = filtros.status ?? "ativos";
  const tipo = filtros.tipo ?? "produtos";

  const [linhas, vendasFinanceiro, pendencias] = await Promise.all([
    prisma.produto.findMany({ where: { userId: contaId }, select: SELECT_LISTA }),
    vendasPorProduto90d(contaId),
    withCache(createCacheKey("pendencias", contaId), () => calcularTodasPendencias(contaId), "pendencias"),
  ]);

  const pendenciasPorProduto = new Map(pendencias.map((p) => [p.produtoId, p.pendencias]));

  // Vendas próprias de cada produto (Financeiro; sem histórico lá, cai no sold_quantity de 90 dias do anúncio).
  const vendasProprias = new Map<string, number>();
  for (const linha of linhas) {
    const doAnuncio = linha.ProdutoMercadoLivre.reduce((s, a) => s + (a.mlSold90Days ?? 0), 0);
    vendasProprias.set(linha.id, vendasFinanceiro ? vendasFinanceiro.get(linha.id) ?? 0 : doAnuncio);
  }
  // Venda de kit também é venda dos componentes (2 adaptadores por kit vendido).
  const vendasEquivalentes = new Map(vendasProprias);
  for (const linha of linhas) {
    if (!linha.isKit) continue;
    const vendasKit = vendasProprias.get(linha.id) ?? 0;
    if (vendasKit === 0) continue;
    for (const componente of linha.componentes) {
      vendasEquivalentes.set(
        componente.produto.id,
        (vendasEquivalentes.get(componente.produto.id) ?? 0) + vendasKit * componente.quantidade
      );
    }
  }

  const estoqueLocalPorProduto = new Map<string, number>();
  for (const linha of linhas) {
    estoqueLocalPorProduto.set(
      linha.id,
      linha.estoques
        .filter((e) => e.armazem.tipo !== ArmazemTipo.FULL_ML)
        .reduce((s, e) => s + e.quantidade, 0)
    );
  }

  const montarItem = (linha: LinhaProduto): ItemListaProduto => {
    const estoqueLocal = estoqueLocalPorProduto.get(linha.id) ?? 0;
    const estoqueSeguranca = linha.estoques.reduce((m, e) => Math.max(m, e.estoqueSeguranca ?? 0), 0);
    const estoqueFull = linha.ProdutoMercadoLivre.filter(
      (a) => a.mlLogisticType === "fulfillment" || a.mlShippingMode === "fulfillment"
    ).reduce((s, a) => s + (a.mlFullDisponivel ?? 0), 0);
    const vendas90d = vendasEquivalentes.get(linha.id) ?? 0;
    const fornecedor = linha.fornecedores[0];
    const kitsMontaveis =
      linha.isKit && linha.componentes.length > 0
        ? Math.min(
            ...linha.componentes.map((c) =>
              c.quantidade > 0 ? Math.floor((estoqueLocalPorProduto.get(c.produto.id) ?? 0) / c.quantidade) : 0
            )
          )
        : null;
    const custoKit =
      linha.isKit && linha.componentes.length > 0 && linha.componentes.every((c) => c.produto.custoMedio != null)
        ? linha.componentes.reduce((s, c) => s + (c.produto.custoMedio as number) * c.quantidade, 0)
        : null;
    const imagem =
      linha.imagemUrl ?? linha.ProdutoMercadoLivre.find((a) => a.mlThumbnail)?.mlThumbnail ?? null;

    return {
      id: linha.id,
      nome: linha.nome,
      sku: linha.sku,
      codigoEAN: linha.ean != null ? linha.ean.toString() : null,
      isKit: linha.isKit,
      ativo: linha.ativo,
      imagemUrl: normalizeImageUrl(imagem),
      custoMedio: linha.isKit ? custoKit : linha.custoMedio,
      fornecedorPrincipal: fornecedor
        ? { id: fornecedor.fornecedor.id, nome: fornecedor.fornecedor.nome, prazoEntregaDias: fornecedor.prazoEntregaDias }
        : null,
      estoqueLocal,
      estoqueSeguranca,
      estoqueFull,
      vendas90d,
      anuncios: linha.ProdutoMercadoLivre.length,
      componentes: linha.componentes.map((c) => ({
        produtoId: c.produto.id,
        nome: c.produto.nome,
        sku: c.produto.sku,
        quantidade: c.quantidade,
      })),
      kitsMontaveis,
      pendencias: pendenciasPorProduto.get(linha.id) ?? [],
      _estoqueLocalTotal: estoqueLocal,
      _mlEstoqueFull: estoqueFull,
      _mlTotalVendas: vendas90d,
      _vinculadoML: linha.ProdutoMercadoLivre.length > 0,
    };
  };

  const termo = filtros.q ? normalizarTexto(filtros.q) : "";
  const termoDigitos = filtros.q ? filtros.q.replace(/\D/g, "") : "";

  const contagens = { produtos: 0, kits: 0, inativos: 0 };
  const fornecedoresMapa = new Map<string, string>();
  const pendenciasPorCodigo: Record<string, number> = {};

  const filtrados: ItemListaProduto[] = [];
  for (const linha of linhas) {
    if (!linha.ativo) contagens.inativos++;
    else if (linha.isKit) contagens.kits++;
    else contagens.produtos++;

    if (status === "ativos" && !linha.ativo) continue;
    if (status === "inativos" && linha.ativo) continue;
    if (tipo === "produtos" && linha.isKit) continue;
    if (tipo === "kits" && !linha.isKit) continue;

    const item = montarItem(linha);
    if (item.fornecedorPrincipal) fornecedoresMapa.set(item.fornecedorPrincipal.id, item.fornecedorPrincipal.nome);
    for (const p of item.pendencias) pendenciasPorCodigo[p.codigo] = (pendenciasPorCodigo[p.codigo] ?? 0) + 1;

    if (termo) {
      const casa =
        normalizarTexto(item.nome).includes(termo) ||
        normalizarTexto(item.sku).includes(termo) ||
        (termoDigitos.length >= 4 && (item.codigoEAN ?? "").includes(termoDigitos));
      if (!casa) continue;
    }
    if (filtros.fornecedorId && filtros.fornecedorId !== "all" && item.fornecedorPrincipal?.id !== filtros.fornecedorId) continue;
    if (filtros.ml === "linked" && item.anuncios === 0) continue;
    if (filtros.ml === "unlinked" && item.anuncios > 0) continue;
    if (filtros.pendencia && !item.pendencias.some((p) => p.codigo === filtros.pendencia)) continue;
    if (filtros.estoque && filtros.estoque !== "all") {
      const disponivel = item.isKit ? item.kitsMontaveis ?? 0 : item.estoqueLocal;
      if (filtros.estoque === "available" && disponivel <= 0) continue;
      if (filtros.estoque === "none" && disponivel !== 0) continue;
      if (filtros.estoque === "low" && !(disponivel > 0 && disponivel <= item.estoqueSeguranca)) continue;
    }
    filtrados.push(item);
  }

  const ordem = filtros.ordem ?? "relevancia";
  const porNome = (a: ItemListaProduto, b: ItemListaProduto) => a.nome.localeCompare(b.nome, "pt-BR");
  filtrados.sort((a, b) => {
    if (ordem === "nome") return porNome(a, b);
    if (ordem === "estoque") return b.estoqueLocal + b.estoqueFull - (a.estoqueLocal + a.estoqueFull) || porNome(a, b);
    if (ordem === "vendas") return b.vendas90d - a.vendas90d || porNome(a, b);
    // relevancia
    if (a.ativo !== b.ativo) return a.ativo ? -1 : 1;
    if (b.vendas90d !== a.vendas90d) return b.vendas90d - a.vendas90d;
    const aTem = a.estoqueLocal + a.estoqueFull > 0;
    const bTem = b.estoqueLocal + b.estoqueFull > 0;
    if (aTem !== bTem) return aTem ? -1 : 1;
    return porNome(a, b);
  });

  const inicio = (pagina - 1) * porPagina;
  const itens = filtrados.slice(inicio, inicio + porPagina);

  return {
    itens,
    total: filtrados.length,
    pagina,
    porPagina,
    temMais: inicio + itens.length < filtrados.length,
    contagens,
    fornecedores: [...fornecedoresMapa.entries()]
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    pendenciasPorCodigo,
  };
}
