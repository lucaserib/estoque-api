import { prisma } from "@/lib/prisma";
import { BlingEscopoError, BlingReconnectError, BlingService } from "@/services/blingService";
import { formatarDataHoraBrasilia, inicioDoDia } from "@/modules/financeiro/dominio/periodo";
import { invalidarCacheFinanceiro } from "@/modules/financeiro/relatorios/cache";

export const SITUACOES_NOTA_VALIDA = new Set([5, 6, 7]);
export const SITUACAO_NOTA_CANCELADA = 2;
const SITUACOES_GUARDADAS = new Set([...SITUACOES_NOTA_VALIDA, SITUACAO_NOTA_CANCELADA]);

export interface NotaFiscalMapeada {
  blingNotaId: string;
  numero: string | null;
  serie: string | null;
  chaveAcesso: string | null;
  situacao: number;
  dataEmissao: Date;
  valorNota: number;
  valorFrete: number;
  numeroPedidoLoja: string | null;
}

function texto(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const limpo = String(valor).trim();
  return limpo.length > 0 ? limpo : null;
}

function numero(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const convertido = typeof valor === "number" ? valor : Number(String(valor).replace(",", "."));
  return Number.isFinite(convertido) ? convertido : null;
}

function centavos(valor: unknown): number | null {
  const n = numero(valor);
  return n === null ? null : Math.round(n * 100);
}

function lerObjeto(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object" ? (valor as Record<string, unknown>) : {};
}

function lerData(valor: unknown): Date | null {
  const bruto = texto(valor);
  if (!bruto) return null;
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(bruto)
    ? `${bruto.replace(" ", "T")}${bruto.length === 16 ? ":00" : ""}-03:00`
    : /^\d{4}-\d{2}-\d{2}$/.test(bruto)
    ? `${bruto}T12:00:00-03:00`
    : bruto;
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? null : data;
}

function lerNumeroPedidoLoja(valor: unknown): { valido: boolean; valor: string | null } {
  if (valor === null || valor === undefined) return { valido: true, valor: null };
  if (typeof valor !== "string" && typeof valor !== "number") return { valido: false, valor: null };
  return { valido: true, valor: texto(valor) };
}

export function mapearNotaFiscal(bruta: Record<string, unknown>): NotaFiscalMapeada | null {
  const id = texto(bruta.id);
  const situacao = numero(bruta.situacao);
  const dataEmissao = lerData(bruta.dataEmissao) ?? lerData(bruta.dataOperacao);
  const transporte = lerObjeto(bruta.transporte);
  const valorNota = centavos(bruta.valorNota ?? bruta.valorTotal ?? bruta.valor);
  const pedidoLoja = lerNumeroPedidoLoja(bruta.numeroPedidoLoja ?? bruta.numeroLoja);

  const camposInvalidos = [
    !id && "id",
    situacao === null && "situacao",
    !dataEmissao && "dataEmissao",
    valorNota === null && "valorNota",
    !pedidoLoja.valido && "numeroPedidoLoja",
  ].filter((campo): campo is string => Boolean(campo));

  if (camposInvalidos.length > 0 || !id || situacao === null || !dataEmissao || valorNota === null) {
    console.warn("[BLING_NOTAS] Nota fora do formato esperado, ignorada", {
      notaId: id,
      camposInvalidos,
      chavesRecebidas: Object.keys(bruta).sort(),
    });
    return null;
  }

  const valorFrete = centavos(bruta.valorFrete ?? transporte.frete ?? transporte.valorFrete) ?? 0;

  return {
    blingNotaId: id,
    numero: texto(bruta.numero),
    serie: texto(bruta.serie),
    chaveAcesso: texto(bruta.chaveAcesso),
    situacao,
    dataEmissao,
    valorNota,
    valorFrete,
    numeroPedidoLoja: pedidoLoja.valor,
  };
}

export function precisaDeDetalhe(bruta: Record<string, unknown>): boolean {
  return bruta.valorNota === undefined || bruta.numeroPedidoLoja === undefined;
}

export interface ResultadoSincronizacaoNotas {
  conectado: boolean;
  lidas: number;
  gravadas: number;
  vinculadas: number;
  completo: boolean;
  erro: string | null;
}

async function vincularVenda(userId: string, numeroPedidoLoja: string | null): Promise<string | null> {
  if (!numeroPedidoLoja) return null;
  const venda = await prisma.vendaCanal.findFirst({
    where: {
      userId,
      OR: [{ pedidoExternoId: numeroPedidoLoja }, { pacoteExternoId: numeroPedidoLoja }],
    },
    select: { id: true },
  });
  return venda?.id ?? null;
}

export async function sincronizarNotasFiscais(
  userId: string,
  desde: Date,
  ate: Date,
  orcamentoMs = 40000
): Promise<ResultadoSincronizacaoNotas> {
  const conta = await prisma.blingAccount.findFirst({
    where: { userId, isActive: true },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  const resultado: ResultadoSincronizacaoNotas = {
    conectado: Boolean(conta),
    lidas: 0,
    gravadas: 0,
    vinculadas: 0,
    completo: true,
    erro: null,
  };
  if (!conta) return resultado;

  const prazo = Date.now() + orcamentoMs;
  const existentes = new Map(
    (
      await prisma.notaFiscalVenda.findMany({
        where: { userId, dataEmissao: { gte: inicioDoDia(desde), lte: ate } },
        select: { id: true, blingNotaId: true, situacao: true, vendaCanalId: true, numeroPedidoLoja: true },
      })
    ).map((n) => [n.blingNotaId, n])
  );

  try {
    for (let pagina = 1; pagina <= 50; pagina++) {
      const lista = await BlingService.listarNotasFiscaisSaida(conta.id, {
        pagina,
        dataEmissaoInicial: formatarDataHoraBrasilia(inicioDoDia(desde)),
        dataEmissaoFinal: formatarDataHoraBrasilia(ate),
      });
      if (lista.length === 0) break;

      for (const item of lista) {
        if (Date.now() > prazo) {
          resultado.completo = false;
          return resultado;
        }
        resultado.lidas++;
        const situacaoLista = numero(item.situacao);
        if (situacaoLista !== null && !SITUACOES_GUARDADAS.has(situacaoLista)) continue;

        const id = texto(item.id);
        if (!id) continue;
        const ja = existentes.get(id);
        if (ja && ja.situacao === situacaoLista) {
          if (!ja.vendaCanalId) {
            const vendaCanalId = await vincularVenda(userId, ja.numeroPedidoLoja);
            if (vendaCanalId) {
              await prisma.notaFiscalVenda.update({ where: { id: ja.id }, data: { vendaCanalId } });
              resultado.vinculadas++;
              resultado.gravadas++;
            }
          }
          continue;
        }

        const bruta = precisaDeDetalhe(item) ? { ...item, ...((await BlingService.obterNotaFiscal(conta.id, id)) ?? {}) } : item;
        const nota = mapearNotaFiscal(bruta);
        if (!nota || !SITUACOES_GUARDADAS.has(nota.situacao)) continue;

        const vendaCanalId = ja?.vendaCanalId ?? (await vincularVenda(userId, nota.numeroPedidoLoja));
        if (vendaCanalId) resultado.vinculadas++;

        await prisma.notaFiscalVenda.upsert({
          where: { userId_blingNotaId: { userId, blingNotaId: nota.blingNotaId } },
          create: { userId, ...nota, vendaCanalId },
          update: { ...nota, vendaCanalId },
        });
        resultado.gravadas++;
      }

      if (lista.length < 100) break;
    }
  } catch (error) {
    if (error instanceof BlingEscopoError || error instanceof BlingReconnectError) throw error;
    resultado.completo = false;
    resultado.erro = error instanceof Error ? error.message : String(error);
  }

  if (resultado.gravadas > 0) await invalidarCacheFinanceiro(userId);
  return resultado;
}
