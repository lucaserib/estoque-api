import {
  Confianca,
  FrequenciaRecorrencia,
  OrigemLancamento,
  StatusLancamento,
  TipoLancamento,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

const MESES_DE_HORIZONTE = 3;

export interface DadosRecorrencia {
  descricao: string;
  valor: number;
  categoriaId: string;
  contaFinanceiraId?: string | null;
  fornecedorId?: string | null;
  frequencia: FrequenciaRecorrencia;
  /** MENSAL/ANUAL: dia do mês (1-31, com piso no fim do mês). SEMANAL: dia da semana, 1=segunda..7=domingo. */
  diaVencimento: number;
  inicio: Date;
  fim?: Date | null;
}

export async function criarRecorrencia(userId: string, dados: DadosRecorrencia) {
  return prisma.recorrenciaFinanceira.create({
    data: {
      userId,
      descricao: dados.descricao,
      valor: dados.valor,
      categoriaId: dados.categoriaId,
      contaFinanceiraId: dados.contaFinanceiraId ?? null,
      fornecedorId: dados.fornecedorId ?? null,
      frequencia: dados.frequencia,
      diaVencimento: dados.diaVencimento,
      inicio: dados.inicio,
      fim: dados.fim ?? null,
      ativo: true,
    },
  });
}

function ultimoDiaDoMes(ano: number, mesIndiceZero: number): number {
  return new Date(Date.UTC(ano, mesIndiceZero + 1, 0)).getUTCDate();
}

function dentroDaJanela(
  data: Date,
  inicio: Date,
  fim: Date | null,
  janelaInicio: Date,
  janelaFim: Date
): boolean {
  if (data < inicio) return false;
  if (fim && data > fim) return false;
  return data >= janelaInicio && data <= janelaFim;
}

function gerarDatasVencimento(
  frequencia: FrequenciaRecorrencia,
  diaVencimento: number,
  inicio: Date,
  fim: Date | null,
  janelaInicio: Date,
  janelaFim: Date
): Date[] {
  const datas: Date[] = [];

  if (frequencia === FrequenciaRecorrencia.MENSAL) {
    let ano = janelaInicio.getUTCFullYear();
    let mes = janelaInicio.getUTCMonth();
    while (new Date(Date.UTC(ano, mes, 1)) <= janelaFim) {
      const dia = Math.min(diaVencimento, ultimoDiaDoMes(ano, mes));
      const vencimento = new Date(Date.UTC(ano, mes, dia));
      if (dentroDaJanela(vencimento, inicio, fim, janelaInicio, janelaFim)) {
        datas.push(vencimento);
      }
      mes += 1;
      if (mes > 11) {
        mes = 0;
        ano += 1;
      }
    }
  } else if (frequencia === FrequenciaRecorrencia.ANUAL) {
    const mesDeInicio = inicio.getUTCMonth();
    for (let ano = janelaInicio.getUTCFullYear(); ano <= janelaFim.getUTCFullYear(); ano++) {
      const dia = Math.min(diaVencimento, ultimoDiaDoMes(ano, mesDeInicio));
      const vencimento = new Date(Date.UTC(ano, mesDeInicio, dia));
      if (dentroDaJanela(vencimento, inicio, fim, janelaInicio, janelaFim)) {
        datas.push(vencimento);
      }
    }
  } else {
    let cursor = new Date(janelaInicio);
    while (cursor <= janelaFim) {
      const diaDaSemanaIso = cursor.getUTCDay() === 0 ? 7 : cursor.getUTCDay();
      if (diaDaSemanaIso === diaVencimento && dentroDaJanela(cursor, inicio, fim, janelaInicio, janelaFim)) {
        datas.push(new Date(cursor));
      }
      cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    }
  }

  return datas;
}

/**
 * Idempotente via chaveExterna (`recorrencia:<id>:<data>`) e via
 * `geradoAte` (nunca reconsidera datas já cobertas) — rodar duas vezes no
 * mesmo dia, ou todo dia do cron, não duplica nada.
 */
export async function gerarLancamentosDaRecorrencia(
  recorrenciaId: string
): Promise<{ gerados: number }> {
  const recorrencia = await prisma.recorrenciaFinanceira.findUniqueOrThrow({
    where: { id: recorrenciaId },
  });
  if (!recorrencia.ativo) return { gerados: 0 };

  const hoje = new Date();
  // Último dia do 3º mês contando o atual como o primeiro — por mês
  // cheio, não por dia corrido, senão o corte varia conforme o dia do mês
  // em que o cron roda (dia 28 gera 1 mês a menos que dia 1).
  const horizonte = new Date(
    Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + MESES_DE_HORIZONTE, 0)
  );
  // Nunca gera pra trás: se `inicio` é antigo (recorrência cadastrada bem
  // depois de já estar em vigor), a janela começa no mês atual, não lá atrás.
  const inicioDoMesAtual = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1));
  const inicioEfetivo = recorrencia.inicio > inicioDoMesAtual ? recorrencia.inicio : inicioDoMesAtual;
  const janelaInicio = recorrencia.geradoAte
    ? new Date(Math.max(recorrencia.geradoAte.getTime() + 24 * 60 * 60 * 1000, inicioEfetivo.getTime()))
    : inicioEfetivo;

  if (janelaInicio > horizonte) return { gerados: 0 };

  const datas = gerarDatasVencimento(
    recorrencia.frequencia,
    recorrencia.diaVencimento,
    recorrencia.inicio,
    recorrencia.fim,
    janelaInicio,
    horizonte
  );

  let gerados = 0;
  for (const vencimento of datas) {
    const chaveExterna = `recorrencia:${recorrencia.id}:${vencimento.toISOString().slice(0, 10)}`;
    await prisma.lancamentoFinanceiro.upsert({
      where: { userId_chaveExterna: { userId: recorrencia.userId, chaveExterna } },
      create: {
        userId: recorrencia.userId,
        criadoPorId: recorrencia.userId,
        tipo: TipoLancamento.DESPESA,
        descricao: recorrencia.descricao,
        valor: recorrencia.valor,
        categoriaId: recorrencia.categoriaId,
        contaFinanceiraId: recorrencia.contaFinanceiraId,
        fornecedorId: recorrencia.fornecedorId,
        competencia: vencimento,
        vencimento,
        status: StatusLancamento.PREVISTO,
        origem: OrigemLancamento.RECORRENCIA,
        confianca: Confianca.CONFIRMADO,
        recorrenciaId: recorrencia.id,
        chaveExterna,
      },
      update: {},
    });
    gerados++;
  }

  await prisma.recorrenciaFinanceira.update({
    where: { id: recorrenciaId },
    data: { geradoAte: horizonte },
  });

  return { gerados };
}

export async function gerarLancamentosDeTodasAsRecorrencias(
  userId: string
): Promise<{ gerados: number }> {
  const recorrencias = await prisma.recorrenciaFinanceira.findMany({
    where: { userId, ativo: true },
    select: { id: true },
  });

  let gerados = 0;
  for (const recorrencia of recorrencias) {
    const resultado = await gerarLancamentosDaRecorrencia(recorrencia.id);
    gerados += resultado.gerados;
  }
  return { gerados };
}

export interface AtualizacaoRecorrencia {
  descricao?: string;
  valor?: number;
  categoriaId?: string;
  contaFinanceiraId?: string | null;
  fornecedorId?: string | null;
  diaVencimento?: number;
  fim?: Date | null;
  ativo?: boolean;
}

export async function atualizarRecorrencia(
  userId: string,
  id: string,
  dados: AtualizacaoRecorrencia,
  aplicarAosPrevistos: boolean
): Promise<void> {
  const recorrencia = await prisma.recorrenciaFinanceira.findFirst({ where: { id, userId } });
  if (!recorrencia) throw new Error("Recorrência não encontrada");

  await prisma.recorrenciaFinanceira.update({ where: { id }, data: dados });

  if (!aplicarAosPrevistos) return;

  const { descricao, valor, categoriaId, contaFinanceiraId, fornecedorId } = dados;
  await prisma.lancamentoFinanceiro.updateMany({
    where: { recorrenciaId: id, status: StatusLancamento.PREVISTO },
    data: {
      ...(descricao !== undefined && { descricao }),
      ...(valor !== undefined && { valor }),
      ...(categoriaId !== undefined && { categoriaId }),
      ...(contaFinanceiraId !== undefined && { contaFinanceiraId }),
      ...(fornecedorId !== undefined && { fornecedorId }),
    },
  });
}
