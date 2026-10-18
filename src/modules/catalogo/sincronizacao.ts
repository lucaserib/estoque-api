import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mlCache } from "@/lib/cache";
import { BlingService } from "@/services/blingService";
import { MercadoLivreService } from "@/services/mercadoLivreService";
import {
  aplicarEstoqueProdutoBling,
  garantirArmazensParaDepositos,
  sincronizarProdutoUnico,
} from "@/services/blingProductSync";
import { emParalelo } from "@/modules/financeiro/ingestao/paralelo";
import {
  atualizarEstoqueFullDosAnuncios,
  listarIdsAnunciosMl,
  registrarErroAnuncio,
  sincronizarAnuncioMl,
} from "./anunciosMl";

export type EtapaCatalogo = "BLING_PRODUTOS" | "BLING_ESTOQUE" | "ML_ANUNCIOS" | "FULL_ESTOQUE";

const ORDEM_ETAPAS: EtapaCatalogo[] = ["BLING_PRODUTOS", "BLING_ESTOQUE", "ML_ANUNCIOS", "FULL_ESTOQUE"];
const LOTE_ESTOQUE_BLING = 50;
const CONCORRENCIA_ML = 4;
const MARGEM_MS = 5000;
const HORAS_VALIDADE_PADRAO = 6;

interface Cursor {
  ids?: Array<string | number>;
  indice: number;
}

interface ProgressoEtapa {
  feitos: number;
  total: number;
  erros: number;
  ultimoErro?: string;
}

type Progresso = Partial<Record<EtapaCatalogo, ProgressoEtapa>>;

export interface StatusCatalogo {
  emAndamento: boolean;
  etapa: EtapaCatalogo | null;
  progresso: Progresso;
  iniciadoEm: string | null;
  concluidoEm: string | null;
  erro: string | null;
  bling: { conectado: boolean; ultimaSincronizacaoProdutos: string | null; ultimaSincronizacaoEstoque: string | null } | null;
  mercadoLivre: { conectado: boolean; anuncios: number; anunciosComErro: number; ultimaSincronizacao: string | null } | null;
}

async function obterOuCriarEstado(userId: string) {
  return prisma.sincronizacaoCatalogo.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

export async function iniciarSincronizacaoCatalogo(userId: string): Promise<void> {
  await obterOuCriarEstado(userId);
  await prisma.sincronizacaoCatalogo.update({
    where: { userId },
    data: {
      etapa: ORDEM_ETAPAS[0],
      cursor: Prisma.JsonNull,
      progresso: {},
      iniciadoEm: new Date(),
      erro: null,
    },
  });
}

async function adquirirTrava(userId: string, orcamentoMs: number): Promise<boolean> {
  const agora = new Date();
  const resultado = await prisma.sincronizacaoCatalogo.updateMany({
    where: { userId, OR: [{ processandoAte: null }, { processandoAte: { lt: agora } }] },
    data: { processandoAte: new Date(agora.getTime() + orcamentoMs + 15000) },
  });
  return resultado.count === 1;
}

function proximaEtapa(etapa: EtapaCatalogo): EtapaCatalogo | null {
  const indice = ORDEM_ETAPAS.indexOf(etapa);
  return ORDEM_ETAPAS[indice + 1] ?? null;
}

function mensagem(erro: unknown): string {
  return (erro instanceof Error ? erro.message : String(erro)).slice(0, 300);
}

interface ContextoEtapa {
  userId: string;
  prazo: number;
  cursor: Cursor;
  progresso: Progresso;
  iniciadoEm: Date;
  salvar: (cursor: Cursor) => Promise<void>;
}

/** Devolve true quando a etapa terminou; false quando o tempo acabou no meio. */
async function executarBlingProdutos(ctx: ContextoEtapa): Promise<boolean> {
  const conta = await prisma.blingAccount.findFirst({
    where: { userId: ctx.userId, isActive: true },
    select: { id: true, ultimaSincronizacaoProdutos: true },
  });
  if (!conta) return true;

  let ids = ctx.cursor.ids as number[] | undefined;
  if (!ids) {
    const desde = conta.ultimaSincronizacaoProdutos
      ? new Date(conta.ultimaSincronizacaoProdutos.getTime() - 60 * 60 * 1000)
          .toISOString()
          .slice(0, 19)
          .replace("T", " ")
      : undefined;
    const produtos = await BlingService.getAllProducts(conta.id, desde);
    ids = produtos.map((p) => p.id);
    ctx.cursor = { ids, indice: 0 };
    ctx.progresso.BLING_PRODUTOS = { feitos: 0, total: ids.length, erros: 0 };
    await ctx.salvar(ctx.cursor);
  }
  const progresso = (ctx.progresso.BLING_PRODUTOS ??= { feitos: 0, total: ids.length, erros: 0 });

  while (ctx.cursor.indice < ids.length) {
    if (Date.now() > ctx.prazo) return false;
    const blingId = ids[ctx.cursor.indice];
    try {
      await sincronizarProdutoUnico(conta.id, ctx.userId, blingId);
    } catch (erro) {
      progresso.erros++;
      progresso.ultimoErro = mensagem(erro);
    }
    ctx.cursor.indice++;
    progresso.feitos = ctx.cursor.indice;
    if (ctx.cursor.indice % 5 === 0) await ctx.salvar(ctx.cursor);
  }

  await prisma.blingAccount.update({
    where: { id: conta.id },
    data: { ultimaSincronizacaoProdutos: ctx.iniciadoEm },
  });
  return true;
}

async function executarBlingEstoque(ctx: ContextoEtapa): Promise<boolean> {
  const conta = await prisma.blingAccount.findFirst({
    where: { userId: ctx.userId, isActive: true },
    select: { id: true },
  });
  if (!conta) return true;

  const produtos = await prisma.produto.findMany({
    where: { userId: ctx.userId, blingId: { not: null }, ativo: true, isKit: false },
    select: { id: true, blingId: true, estoques: { select: { armazemId: true, quantidade: true } } },
    orderBy: { id: "asc" },
  });
  const progresso = (ctx.progresso.BLING_ESTOQUE ??= { feitos: 0, total: produtos.length, erros: 0 });
  progresso.total = produtos.length;
  if (produtos.length === 0) return true;

  const armazemPorDeposito = await garantirArmazensParaDepositos(conta.id, ctx.userId);

  while (ctx.cursor.indice < produtos.length) {
    if (Date.now() > ctx.prazo) return false;
    const lote = produtos.slice(ctx.cursor.indice, ctx.cursor.indice + LOTE_ESTOQUE_BLING);
    try {
      const { data: saldos } = await BlingService.getProductsStock(
        conta.id,
        lote.map((p) => Number(p.blingId))
      );
      const saldoPorBlingId = new Map(saldos.map((s) => [String(s.produto.id), s]));
      for (const produto of lote) {
        const saldo = saldoPorBlingId.get(String(produto.blingId));
        if (!saldo) continue;
        await aplicarEstoqueProdutoBling({
          userId: ctx.userId,
          produtoLocalId: produto.id,
          depositosSaldo: saldo.depositos,
          armazemPorDeposito,
          estoquesAtuais: produto.estoques,
        });
      }
    } catch (erro) {
      progresso.erros += lote.length;
      progresso.ultimoErro = mensagem(erro);
    }
    ctx.cursor.indice += lote.length;
    progresso.feitos = ctx.cursor.indice;
    await ctx.salvar(ctx.cursor);
  }

  await prisma.blingAccount.update({
    where: { id: conta.id },
    data: { ultimaSincronizacaoEstoque: new Date() },
  });
  return true;
}

async function executarMlAnuncios(ctx: ContextoEtapa): Promise<boolean> {
  const conta = await prisma.mercadoLivreAccount.findFirst({
    where: { userId: ctx.userId, isActive: true },
    select: { id: true, userId: true, siteId: true, mlUserId: true },
  });
  if (!conta) return true;

  const accessToken = await MercadoLivreService.getValidToken(conta.id);
  let ids = ctx.cursor.ids as string[] | undefined;
  if (!ids) {
    ids = await listarIdsAnunciosMl(accessToken, conta.mlUserId);
    ctx.cursor = { ids, indice: 0 };
    ctx.progresso.ML_ANUNCIOS = { feitos: 0, total: ids.length, erros: 0 };
    await ctx.salvar(ctx.cursor);
  }
  const progresso = (ctx.progresso.ML_ANUNCIOS ??= { feitos: 0, total: ids.length, erros: 0 });

  while (ctx.cursor.indice < ids.length) {
    if (Date.now() > ctx.prazo) return false;
    const lote = ids.slice(ctx.cursor.indice, ctx.cursor.indice + CONCORRENCIA_ML * 2);
    await emParalelo(lote, CONCORRENCIA_ML, async (itemId) => {
      try {
        await sincronizarAnuncioMl(conta, accessToken, itemId);
      } catch (erro) {
        progresso.erros++;
        progresso.ultimoErro = mensagem(erro);
        await registrarErroAnuncio(conta.id, itemId, mensagem(erro));
      }
    });
    ctx.cursor.indice += lote.length;
    progresso.feitos = ctx.cursor.indice;
    await ctx.salvar(ctx.cursor);
  }
  return true;
}

async function executarFullEstoque(ctx: ContextoEtapa): Promise<boolean> {
  const conta = await prisma.mercadoLivreAccount.findFirst({
    where: { userId: ctx.userId, isActive: true },
    select: { id: true },
  });
  if (!conta) return true;
  const alterados = await atualizarEstoqueFullDosAnuncios(ctx.userId, conta.id);
  ctx.progresso.FULL_ESTOQUE = { feitos: alterados, total: alterados, erros: 0 };
  return true;
}

const EXECUTORES: Record<EtapaCatalogo, (ctx: ContextoEtapa) => Promise<boolean>> = {
  BLING_PRODUTOS: executarBlingProdutos,
  BLING_ESTOQUE: executarBlingEstoque,
  ML_ANUNCIOS: executarMlAnuncios,
  FULL_ESTOQUE: executarFullEstoque,
};

/**
 * Atualiza o catálogo e o estoque em etapas retomáveis: produtos do Bling
 * (novos e alterados) → saldo de estoque do Bling por depósito → anúncios do
 * ML (preço, estoque, status, logística, tarifa, frete e estoque Full) →
 * estoque Full gravado no armazém Full. Cada etapa guarda o cursor; uma
 * etapa que falha registra o erro e o processo segue para a próxima.
 */
export async function processarSincronizacaoCatalogo(userId: string, orcamentoMs: number): Promise<StatusCatalogo> {
  const estado = await obterOuCriarEstado(userId);
  if (!estado.etapa) return obterStatusCatalogo(userId);
  if (!(await adquirirTrava(userId, orcamentoMs))) return obterStatusCatalogo(userId);

  const prazo = Date.now() + orcamentoMs - MARGEM_MS;
  let etapa: EtapaCatalogo | null = estado.etapa as EtapaCatalogo;
  let cursor: Cursor = (estado.cursor as unknown as Cursor | null) ?? { indice: 0 };
  const progresso: Progresso = (estado.progresso as unknown as Progresso | null) ?? {};
  const erros: string[] = estado.erro ? [estado.erro] : [];
  const iniciadoEm = estado.iniciadoEm ?? new Date();

  const salvar = async (novoCursor: Cursor) => {
    await prisma.sincronizacaoCatalogo.update({
      where: { userId },
      data: { etapa, cursor: novoCursor as unknown as Prisma.InputJsonValue, progresso: progresso as Prisma.InputJsonValue },
    });
  };

  try {
    while (etapa && Date.now() < prazo) {
      const ctx: ContextoEtapa = { userId, prazo, cursor, progresso, iniciadoEm, salvar };
      let terminou: boolean;
      try {
        terminou = await EXECUTORES[etapa](ctx);
      } catch (erro) {
        erros.push(`${etapa}: ${mensagem(erro)}`);
        terminou = true;
      }
      cursor = ctx.cursor;
      if (!terminou) break;
      etapa = proximaEtapa(etapa);
      cursor = { indice: 0 };
    }

    await prisma.sincronizacaoCatalogo.update({
      where: { userId },
      data: {
        etapa,
        cursor: etapa ? (cursor as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        progresso: progresso as Prisma.InputJsonValue,
        erro: erros.length > 0 ? erros.join(" | ").slice(0, 1000) : null,
        ...(etapa ? {} : { concluidoEm: new Date() }),
      },
    });
    if (!etapa) await mlCache.invalidatePattern(`user:${userId}:`);
  } finally {
    await prisma.sincronizacaoCatalogo.update({ where: { userId }, data: { processandoAte: null } });
  }

  return obterStatusCatalogo(userId);
}

/** Começa uma nova rodada se a última terminou há mais de `horasValidade` (ou nunca rodou) e processa. */
export async function sincronizarCatalogoSeNecessario(
  userId: string,
  orcamentoMs: number,
  opcoes: { forcar?: boolean; horasValidade?: number } = {}
): Promise<StatusCatalogo> {
  const estado = await obterOuCriarEstado(userId);
  const validade = (opcoes.horasValidade ?? HORAS_VALIDADE_PADRAO) * 60 * 60 * 1000;
  const vencido = !estado.concluidoEm || Date.now() - estado.concluidoEm.getTime() > validade;
  if (!estado.etapa && (opcoes.forcar || vencido)) await iniciarSincronizacaoCatalogo(userId);
  return processarSincronizacaoCatalogo(userId, orcamentoMs);
}

export async function obterStatusCatalogo(userId: string): Promise<StatusCatalogo> {
  const [estado, bling, ml] = await Promise.all([
    prisma.sincronizacaoCatalogo.findUnique({ where: { userId } }),
    prisma.blingAccount.findFirst({
      where: { userId, isActive: true },
      select: { ultimaSincronizacaoProdutos: true, ultimaSincronizacaoEstoque: true },
    }),
    prisma.mercadoLivreAccount.findFirst({ where: { userId, isActive: true }, select: { id: true } }),
  ]);

  let mercadoLivre: StatusCatalogo["mercadoLivre"] = null;
  if (ml) {
    const [anuncios, anunciosComErro, ultimo] = await Promise.all([
      prisma.produtoMercadoLivre.count({ where: { mercadoLivreAccountId: ml.id } }),
      prisma.produtoMercadoLivre.count({ where: { mercadoLivreAccountId: ml.id, syncStatus: "error" } }),
      prisma.produtoMercadoLivre.findFirst({
        where: { mercadoLivreAccountId: ml.id },
        orderBy: { lastSyncAt: "desc" },
        select: { lastSyncAt: true },
      }),
    ]);
    mercadoLivre = {
      conectado: true,
      anuncios,
      anunciosComErro,
      ultimaSincronizacao: ultimo?.lastSyncAt?.toISOString() ?? null,
    };
  }

  return {
    emAndamento: Boolean(estado?.etapa),
    etapa: (estado?.etapa as EtapaCatalogo | null) ?? null,
    progresso: (estado?.progresso as unknown as Progresso | null) ?? {},
    iniciadoEm: estado?.iniciadoEm?.toISOString() ?? null,
    concluidoEm: estado?.concluidoEm?.toISOString() ?? null,
    erro: estado?.erro ?? null,
    bling: bling
      ? {
          conectado: true,
          ultimaSincronizacaoProdutos: bling.ultimaSincronizacaoProdutos?.toISOString() ?? null,
          ultimaSincronizacaoEstoque: bling.ultimaSincronizacaoEstoque?.toISOString() ?? null,
        }
      : null,
    mercadoLivre,
  };
}
