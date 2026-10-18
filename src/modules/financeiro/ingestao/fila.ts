import {
  CanalVenda,
  StatusTarefaSincronizacao,
  TipoTarefaSincronizacao,
  type TarefaSincronizacaoFinanceira,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buscarPaginaPedidos } from "../canais/mercadoLivre/cliente";
import type { ContaCanal } from "../canais/tipos";
import { inicioDoDia, fimDoDia, inicioDoMes, fimDoMes } from "../dominio/periodo";
import { ingerirGastosAdsDoDia } from "./ingestaoAds";
import { ingerirCobrancasDoMes } from "./ingestaoCobrancas";
import { ingerirPedidosEmLote } from "./lote";
import { contarVendasAguardandoDetalhes, enriquecerVendasPendentes } from "./enriquecimento";
import { mensagemDeErro, obterUserIdDaConta, tempoMaximoLoteMs } from "./sincronizador";

const MINUTOS_TRAVA_TAREFA = 2;
const MARGEM_FINAL_MS = 4000;
const HORAS_SOBREPOSICAO_INCREMENTAL = 2;
const HORAS_INCREMENTAL_SEM_HISTORICO = 48;
const TENTATIVAS_MAXIMAS_TAREFA = 5;

function mesReferenciaDe(data: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).format(data);
}

export interface ParametrosEnfileirar {
  userId: string;
  canal: CanalVenda;
  contaCanalId: string;
  tipo: TipoTarefaSincronizacao;
  desde?: Date | null;
  ate?: Date | null;
  prioridade?: number;
  forcar?: boolean;
}

export async function enfileirarTarefa(
  params: ParametrosEnfileirar
): Promise<TarefaSincronizacaoFinanceira> {
  const existente = await prisma.tarefaSincronizacaoFinanceira.findFirst({
    where: {
      userId: params.userId,
      contaCanalId: params.contaCanalId,
      tipo: params.tipo,
      status: { in: [StatusTarefaSincronizacao.PENDENTE, StatusTarefaSincronizacao.EM_ANDAMENTO] },
      desde: params.desde ?? null,
      ate: params.ate ?? null,
      forcar: params.forcar ?? false,
    },
    orderBy: { criadaEm: "desc" },
  });

  if (existente) {
    if (params.prioridade != null && params.prioridade > existente.prioridade) {
      return prisma.tarefaSincronizacaoFinanceira.update({
        where: { id: existente.id },
        data: { prioridade: params.prioridade },
      });
    }
    return existente;
  }

  return prisma.tarefaSincronizacaoFinanceira.create({
    data: {
      userId: params.userId,
      canal: params.canal,
      contaCanalId: params.contaCanalId,
      tipo: params.tipo,
      desde: params.desde ?? null,
      ate: params.ate ?? null,
      prioridade: params.prioridade ?? 0,
      forcar: params.forcar ?? false,
    },
  });
}

async function obterProximaTarefa(
  userId: string,
  contaCanalId: string
): Promise<TarefaSincronizacaoFinanceira | null> {
  const agora = new Date();
  return prisma.tarefaSincronizacaoFinanceira.findFirst({
    where: {
      userId,
      contaCanalId,
      tentativas: { lt: TENTATIVAS_MAXIMAS_TAREFA },
      OR: [
        { status: StatusTarefaSincronizacao.PENDENTE },
        { status: StatusTarefaSincronizacao.EM_ANDAMENTO, bloqueadaAte: null },
        { status: StatusTarefaSincronizacao.EM_ANDAMENTO, bloqueadaAte: { lt: agora } },
      ],
    },
    orderBy: [{ prioridade: "desc" }, { criadaEm: "asc" }],
  });
}

type StatusExecucao = "OCIOSO" | "CONCLUIDA" | "EM_ANDAMENTO" | "ERRO" | "OCUPADO";

export interface ResultadoExecucaoFila {
  tarefaId: string | null;
  tipo: TipoTarefaSincronizacao | null;
  status: StatusExecucao;
  processados: number;
  vendasDetalhadas: number;
  aguardandoDetalhes: number;
  tarefasPendentes: number;
}

interface ResultadoTarefa {
  concluida: boolean;
  processados: number;
}

interface CursorPeriodo {
  inicioJanela: string;
  offset: number;
}

function janelaDoMes(instante: Date, desde: Date, ate: Date): { inicio: Date; fim: Date } {
  const inicioMes = inicioDoMes(instante);
  const fimMes = fimDoMes(instante);
  return {
    inicio: inicioMes < desde ? desde : inicioMes,
    fim: fimMes > ate ? ate : fimMes,
  };
}

/**
 * Importa os pedidos criados no período, do mês mais recente para o mais
 * antigo (o mês atual fica certo primeiro), uma página de 50 pedidos por vez,
 * gravando o cursor a cada página. Cada página é gravada em lote, sem
 * chamadas extras por pedido.
 */
async function executarPedidosPeriodo(
  tarefa: TarefaSincronizacaoFinanceira,
  prazoFinal: number
): Promise<ResultadoTarefa> {
  const contaCanal: ContaCanal = { contaCanalId: tarefa.contaCanalId, userId: tarefa.userId };
  const desde = tarefa.desde ?? inicioDoDia(new Date());
  const ate = tarefa.ate ?? fimDoDia(new Date());

  const salvo = tarefa.cursor as unknown as CursorPeriodo | null;
  let janela = salvo?.inicioJanela
    ? janelaDoMes(new Date(salvo.inicioJanela), desde, ate)
    : janelaDoMes(ate, desde, ate);
  let offset = salvo?.offset ?? 0;
  let processados = 0;

  while (Date.now() < prazoFinal) {
    const pagina = await buscarPaginaPedidos(tarefa.contaCanalId, {
      campoData: "date_created",
      desde: janela.inicio,
      ate: janela.fim,
      offset,
      ordem: "date_desc",
    });
    await ingerirPedidosEmLote(contaCanal, pagina.pedidos, { forcar: tarefa.forcar, etapa: "PEDIDOS_PERIODO" });
    processados += pagina.pedidos.length;

    let concluida = false;
    if (pagina.proximoOffset != null) {
      offset = pagina.proximoOffset;
    } else {
      const fimMesAnterior = new Date(janela.inicio.getTime() - 1);
      if (fimMesAnterior < desde) {
        concluida = true;
      } else {
        janela = janelaDoMes(fimMesAnterior, desde, ate);
        offset = 0;
      }
    }

    await prisma.tarefaSincronizacaoFinanceira.update({
      where: { id: tarefa.id },
      data: {
        cursor: { inicioJanela: janela.inicio.toISOString(), offset },
        processados: { increment: pagina.pedidos.length },
        ...(concluida
          ? { status: StatusTarefaSincronizacao.CONCLUIDA, concluidaEm: new Date(), bloqueadaAte: null, erro: null }
          : { bloqueadaAte: new Date(Date.now() + MINUTOS_TRAVA_TAREFA * 60 * 1000) }),
      },
    });
    if (concluida) return { concluida: true, processados };
  }

  return { concluida: false, processados };
}

async function executarPedidosIncremental(
  tarefa: TarefaSincronizacaoFinanceira,
  prazoFinal: number
): Promise<ResultadoTarefa> {
  const contaCanal: ContaCanal = { contaCanalId: tarefa.contaCanalId, userId: tarefa.userId };
  const conta = await prisma.mercadoLivreAccount.findUnique({
    where: { id: tarefa.contaCanalId },
    select: { ultimaSincronizacaoFinanceiraEm: true },
  });
  const ate = tarefa.ate ?? tarefa.criadaEm;
  const desde =
    tarefa.desde ??
    (conta?.ultimaSincronizacaoFinanceiraEm
      ? new Date(conta.ultimaSincronizacaoFinanceiraEm.getTime() - HORAS_SOBREPOSICAO_INCREMENTAL * 60 * 60 * 1000)
      : new Date(ate.getTime() - HORAS_INCREMENTAL_SEM_HISTORICO * 60 * 60 * 1000));

  const salvo = tarefa.cursor as unknown as { offset?: number } | null;
  let offset = salvo?.offset ?? 0;
  let processados = 0;

  while (Date.now() < prazoFinal) {
    const pagina = await buscarPaginaPedidos(tarefa.contaCanalId, {
      campoData: "date_last_updated",
      desde,
      ate,
      offset,
      ordem: "date_asc",
    });
    await ingerirPedidosEmLote(contaCanal, pagina.pedidos, { etapa: "PEDIDOS_INCREMENTAL" });
    processados += pagina.pedidos.length;

    if (pagina.proximoOffset == null) {
      await prisma.mercadoLivreAccount.update({
        where: { id: tarefa.contaCanalId },
        data: { ultimaSincronizacaoFinanceiraEm: ate },
      });
      await prisma.tarefaSincronizacaoFinanceira.update({
        where: { id: tarefa.id },
        data: {
          status: StatusTarefaSincronizacao.CONCLUIDA,
          concluidaEm: new Date(),
          bloqueadaAte: null,
          erro: null,
          processados: { increment: pagina.pedidos.length },
        },
      });
      return { concluida: true, processados };
    }

    offset = pagina.proximoOffset;
    await prisma.tarefaSincronizacaoFinanceira.update({
      where: { id: tarefa.id },
      data: {
        cursor: { offset },
        processados: { increment: pagina.pedidos.length },
        bloqueadaAte: new Date(Date.now() + MINUTOS_TRAVA_TAREFA * 60 * 1000),
      },
    });
  }

  return { concluida: false, processados };
}

async function executarAds(tarefa: TarefaSincronizacaoFinanceira): Promise<ResultadoTarefa> {
  const desde = inicioDoDia(tarefa.desde ?? new Date());
  const ate = fimDoDia(tarefa.ate ?? new Date());

  let processados = 0;
  let cursorDia = desde;
  while (cursorDia <= ate) {
    const resultado = await ingerirGastosAdsDoDia(tarefa.contaCanalId, cursorDia);
    processados += resultado.processados;
    cursorDia = new Date(fimDoDia(cursorDia).getTime() + 1);
  }

  await prisma.tarefaSincronizacaoFinanceira.update({
    where: { id: tarefa.id },
    data: { status: StatusTarefaSincronizacao.CONCLUIDA, concluidaEm: new Date(), bloqueadaAte: null, processados },
  });
  return { concluida: true, processados };
}

async function executarCobrancas(tarefa: TarefaSincronizacaoFinanceira): Promise<ResultadoTarefa> {
  const desde = tarefa.desde ?? new Date();
  const ate = tarefa.ate ?? new Date();

  let processados = 0;
  let cursorMes = inicioDoMes(desde);
  while (cursorMes <= ate) {
    const resultado = await ingerirCobrancasDoMes(tarefa.contaCanalId, mesReferenciaDe(cursorMes));
    processados += resultado.processadas;
    cursorMes = new Date(fimDoMes(cursorMes).getTime() + 1);
  }

  await prisma.tarefaSincronizacaoFinanceira.update({
    where: { id: tarefa.id },
    data: { status: StatusTarefaSincronizacao.CONCLUIDA, concluidaEm: new Date(), bloqueadaAte: null, processados },
  });
  return { concluida: true, processados };
}

async function executarTarefa(
  tarefa: TarefaSincronizacaoFinanceira,
  prazoFinal: number
): Promise<ResultadoTarefa> {
  switch (tarefa.tipo) {
    case TipoTarefaSincronizacao.PEDIDOS_PERIODO:
      return executarPedidosPeriodo(tarefa, prazoFinal);
    case TipoTarefaSincronizacao.PEDIDOS_INCREMENTAL:
      return executarPedidosIncremental(tarefa, prazoFinal);
    case TipoTarefaSincronizacao.ADS:
      return executarAds(tarefa);
    case TipoTarefaSincronizacao.COBRANCAS:
      return executarCobrancas(tarefa);
    default:
      await prisma.tarefaSincronizacaoFinanceira.update({
        where: { id: tarefa.id },
        data: {
          status: StatusTarefaSincronizacao.ERRO,
          erro: `Tipo de tarefa não implementado: ${tarefa.tipo}`,
          bloqueadaAte: null,
        },
      });
      return { concluida: true, processados: 0 };
  }
}

/**
 * Uma execução por conta por vez: a coluna `financeiroProcessandoAte` funciona
 * como trava com validade — se outra requisição já está processando, esta
 * devolve OCUPADO na hora em vez de duplicar chamadas à API.
 */
async function adquirirTravaConta(contaCanalId: string, orcamentoMs: number): Promise<boolean> {
  const agora = new Date();
  const resultado = await prisma.mercadoLivreAccount.updateMany({
    where: {
      id: contaCanalId,
      OR: [{ financeiroProcessandoAte: null }, { financeiroProcessandoAte: { lt: agora } }],
    },
    data: { financeiroProcessandoAte: new Date(agora.getTime() + orcamentoMs + 15000) },
  });
  return resultado.count === 1;
}

async function liberarTravaConta(contaCanalId: string): Promise<void> {
  await prisma.mercadoLivreAccount.update({
    where: { id: contaCanalId },
    data: { financeiroProcessandoAte: null },
  });
}

export async function contarTarefasPendentes(userId: string, contaCanalId: string): Promise<number> {
  return prisma.tarefaSincronizacaoFinanceira.count({
    where: {
      userId,
      contaCanalId,
      tentativas: { lt: TENTATIVAS_MAXIMAS_TAREFA },
      status: { in: [StatusTarefaSincronizacao.PENDENTE, StatusTarefaSincronizacao.EM_ANDAMENTO] },
    },
  });
}

/**
 * Processa a fila da conta dentro do orçamento de tempo: primeiro as tarefas
 * (importar pedidos, cobranças, ads), por prioridade; com o tempo que sobrar,
 * detalha as vendas que ainda não têm os dados do pagamento.
 */
export async function executarFila(
  userId: string,
  contaCanalId: string,
  orcamentoMs: number = tempoMaximoLoteMs()
): Promise<ResultadoExecucaoFila> {
  const inicio = Date.now();
  const prazoFinal = inicio + orcamentoMs - MARGEM_FINAL_MS;
  const resultado: ResultadoExecucaoFila = {
    tarefaId: null,
    tipo: null,
    status: "OCIOSO",
    processados: 0,
    vendasDetalhadas: 0,
    aguardandoDetalhes: 0,
    tarefasPendentes: 0,
  };

  if (!(await adquirirTravaConta(contaCanalId, orcamentoMs))) {
    resultado.status = "OCUPADO";
    resultado.tarefasPendentes = await contarTarefasPendentes(userId, contaCanalId);
    resultado.aguardandoDetalhes = await contarVendasAguardandoDetalhes(contaCanalId);
    return resultado;
  }

  try {
    while (Date.now() < prazoFinal) {
      const tarefa = await obterProximaTarefa(userId, contaCanalId);
      if (!tarefa) break;

      resultado.tarefaId = tarefa.id;
      resultado.tipo = tarefa.tipo;
      await prisma.tarefaSincronizacaoFinanceira.update({
        where: { id: tarefa.id },
        data: {
          status: StatusTarefaSincronizacao.EM_ANDAMENTO,
          bloqueadaAte: new Date(Date.now() + MINUTOS_TRAVA_TAREFA * 60 * 1000),
        },
      });

      try {
        const execucao = await executarTarefa(tarefa, prazoFinal);
        resultado.processados += execucao.processados;
        resultado.status = execucao.concluida ? "CONCLUIDA" : "EM_ANDAMENTO";
        if (!execucao.concluida) break;
      } catch (erro) {
        resultado.status = "ERRO";
        await prisma.tarefaSincronizacaoFinanceira.update({
          where: { id: tarefa.id },
          data: {
            status: StatusTarefaSincronizacao.PENDENTE,
            tentativas: { increment: 1 },
            erro: mensagemDeErro(erro).slice(0, 500),
            bloqueadaAte: null,
          },
        });
        break;
      }
    }

    const restanteMs = prazoFinal - Date.now();
    if (restanteMs > 8000) {
      const enriquecimento = await enriquecerVendasPendentes(contaCanalId, userId, restanteMs);
      resultado.vendasDetalhadas = enriquecimento.processados;
      resultado.aguardandoDetalhes = enriquecimento.restantes;
    } else {
      resultado.aguardandoDetalhes = await contarVendasAguardandoDetalhes(contaCanalId);
    }
    resultado.tarefasPendentes = await contarTarefasPendentes(userId, contaCanalId);
    if (resultado.tarefasPendentes > 0 || resultado.aguardandoDetalhes > 0) {
      if (resultado.status !== "ERRO") resultado.status = "EM_ANDAMENTO";
    } else if (resultado.status !== "ERRO") {
      resultado.status = resultado.processados > 0 || resultado.vendasDetalhadas > 0 ? "CONCLUIDA" : "OCIOSO";
    }
    return resultado;
  } finally {
    await liberarTravaConta(contaCanalId);
  }
}

export async function enfileirarPeriodo(
  accountId: string,
  desde: Date,
  ate: Date,
  prioridade = 0,
  forcar = false
): Promise<TarefaSincronizacaoFinanceira | null> {
  const userId = await obterUserIdDaConta(accountId);
  if (!userId) return null;
  return enfileirarTarefa({
    userId,
    canal: CanalVenda.MERCADO_LIVRE,
    contaCanalId: accountId,
    tipo: TipoTarefaSincronizacao.PEDIDOS_PERIODO,
    desde,
    ate,
    prioridade,
    forcar,
  });
}

export async function enfileirarIncremental(
  accountId: string,
  prioridade = 0
): Promise<TarefaSincronizacaoFinanceira | null> {
  const userId = await obterUserIdDaConta(accountId);
  if (!userId) return null;
  return enfileirarTarefa({
    userId,
    canal: CanalVenda.MERCADO_LIVRE,
    contaCanalId: accountId,
    tipo: TipoTarefaSincronizacao.PEDIDOS_INCREMENTAL,
    prioridade,
  });
}

export async function enfileirarCobrancas(
  accountId: string,
  desde: Date,
  ate: Date,
  prioridade = 0
): Promise<TarefaSincronizacaoFinanceira | null> {
  const userId = await obterUserIdDaConta(accountId);
  if (!userId) return null;
  return enfileirarTarefa({
    userId,
    canal: CanalVenda.MERCADO_LIVRE,
    contaCanalId: accountId,
    tipo: TipoTarefaSincronizacao.COBRANCAS,
    desde: inicioDoMes(desde),
    ate: fimDoMes(ate),
    prioridade,
  });
}
