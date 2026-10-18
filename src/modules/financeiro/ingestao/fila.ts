import {
  CanalVenda,
  StatusTarefaSincronizacao,
  TipoTarefaSincronizacao,
  type TarefaSincronizacaoFinanceira,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { obterAdaptador } from "../canais/registro";
import { listarPedidosCriadosNoPeriodo } from "../canais/mercadoLivre/cliente";
import { mapearPedido } from "../canais/mercadoLivre/mapeador";
import type { MLOrder } from "@/types/mercadolivre";
import type { ContaCanal } from "../canais/tipos";
import { inicioDoDia, fimDoDia } from "../dominio/periodo";
import { ingerirGastosAdsDoDia } from "./ingestaoAds";
import { ingerirCobrancasDoMes } from "./ingestaoCobrancas";
import {
  ingerirPedidoComRegistroDeErro,
  ingerirVendaNormalizada,
  mensagemDeErro,
  obterUserIdDaConta,
  registrarErroPedido,
  resolverErroPedido,
  tempoMaximoLoteMs,
} from "./sincronizador";

const MINUTOS_TRAVA = 2;

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
      OR: [
        { status: StatusTarefaSincronizacao.PENDENTE },
        { status: StatusTarefaSincronizacao.EM_ANDAMENTO, bloqueadaAte: { lt: agora } },
      ],
    },
    orderBy: [{ prioridade: "desc" }, { criadaEm: "asc" }],
  });
}

export interface ResultadoExecucaoFila {
  tarefaId: string | null;
  tipo: TipoTarefaSincronizacao | null;
  status: "OCIOSO" | "CONCLUIDA" | "EM_ANDAMENTO" | "ERRO";
  processados: number;
}

interface CursorPeriodo {
  diaAtual: string;
  offsetNoDia: number;
}

async function deveIgnorarPedido(
  userId: string,
  canal: CanalVenda,
  pedidoBruto: MLOrder
): Promise<boolean> {
  if (!pedidoBruto.last_updated) return false;
  const existente = await prisma.vendaCanal.findUnique({
    where: {
      userId_canal_pedidoExternoId: { userId, canal, pedidoExternoId: String(pedidoBruto.id) },
    },
    select: { atualizadoNoCanalEm: true, completo: true },
  });
  if (!existente || !existente.completo) return false;
  return existente.atualizadoNoCanalEm.getTime() === new Date(pedidoBruto.last_updated).getTime();
}

async function ingerirPedidoBrutoComRegistro(
  contaCanal: ContaCanal,
  canal: CanalVenda,
  pedidoBruto: MLOrder,
  etapa: string,
  forcar: boolean
): Promise<void> {
  if (!forcar && (await deveIgnorarPedido(contaCanal.userId, canal, pedidoBruto))) return;

  const adaptador = obterAdaptador(canal);
  try {
    const precisaDescontos = Array.isArray(pedidoBruto.tags) && pedidoBruto.tags.includes("order_has_discount");
    const descontos =
      precisaDescontos && adaptador.obterDescontos
        ? await adaptador.obterDescontos(contaCanal, String(pedidoBruto.id))
        : null;

    const normalizado = mapearPedido(pedidoBruto, descontos);
    if (!normalizado) return;

    await ingerirVendaNormalizada(contaCanal, adaptador, normalizado);
    await resolverErroPedido(contaCanal.userId, canal, String(pedidoBruto.id));
  } catch (erro) {
    await registrarErroPedido(contaCanal.userId, canal, String(pedidoBruto.id), etapa, mensagemDeErro(erro));
  }
}

async function executarPedidosPeriodo(
  tarefa: TarefaSincronizacaoFinanceira,
  orcamentoMs: number
): Promise<ResultadoExecucaoFila> {
  const contaCanal: ContaCanal = { contaCanalId: tarefa.contaCanalId, userId: tarefa.userId };
  const desde = tarefa.desde ?? inicioDoDia(new Date());
  const ate = tarefa.ate ?? fimDoDia(new Date());

  const cursorSalvo = (tarefa.cursor as unknown as CursorPeriodo | null) ?? {
    diaAtual: inicioDoDia(desde).toISOString(),
    offsetNoDia: 0,
  };

  let diaAtual = new Date(cursorSalvo.diaAtual);
  let indiceNoDia = cursorSalvo.offsetNoDia;
  let processadosNoLote = 0;
  const inicioLote = Date.now();

  const salvarProgresso = async (novoIndice: number) => {
    await prisma.tarefaSincronizacaoFinanceira.update({
      where: { id: tarefa.id },
      data: {
        cursor: { diaAtual: diaAtual.toISOString(), offsetNoDia: novoIndice },
        processados: { increment: processadosNoLote },
        bloqueadaAte: null,
      },
    });
  };

  while (diaAtual <= ate) {
    const fimDoDiaAtual = fimDoDia(diaAtual);
    const fimEfetivo = fimDoDiaAtual < ate ? fimDoDiaAtual : ate;
    const pedidosDoDia = await listarPedidosCriadosNoPeriodo(tarefa.contaCanalId, diaAtual, fimEfetivo);

    while (indiceNoDia < pedidosDoDia.length) {
      if (Date.now() - inicioLote >= orcamentoMs) {
        await salvarProgresso(indiceNoDia);
        return { tarefaId: tarefa.id, tipo: tarefa.tipo, status: "EM_ANDAMENTO", processados: processadosNoLote };
      }

      await ingerirPedidoBrutoComRegistro(
        contaCanal,
        tarefa.canal,
        pedidosDoDia[indiceNoDia],
        "PEDIDOS_PERIODO",
        tarefa.forcar
      );
      processadosNoLote++;
      indiceNoDia++;
    }

    diaAtual = new Date(fimEfetivo.getTime() + 1);
    indiceNoDia = 0;
  }

  await prisma.tarefaSincronizacaoFinanceira.update({
    where: { id: tarefa.id },
    data: {
      status: StatusTarefaSincronizacao.CONCLUIDA,
      concluidaEm: new Date(),
      bloqueadaAte: null,
      processados: { increment: processadosNoLote },
    },
  });
  return { tarefaId: tarefa.id, tipo: tarefa.tipo, status: "CONCLUIDA", processados: processadosNoLote };
}

async function executarPedidosIncremental(
  tarefa: TarefaSincronizacaoFinanceira,
  orcamentoMs: number
): Promise<ResultadoExecucaoFila> {
  const contaCanal: ContaCanal = { contaCanalId: tarefa.contaCanalId, userId: tarefa.userId };
  const adaptador = obterAdaptador(tarefa.canal);
  const desde = tarefa.desde ?? new Date(Date.now() - 48 * 60 * 60 * 1000);
  const ate = tarefa.ate ?? new Date();

  const cursorSalvo = tarefa.cursor as unknown as { offset: string | null } | null;
  let cursor: string | null = cursorSalvo?.offset ?? null;
  let processadosNoLote = 0;
  const inicioLote = Date.now();

  while (Date.now() - inicioLote < orcamentoMs) {
    const pagina = await adaptador.listarPedidosAlterados(contaCanal, desde, ate, cursor);
    for (const pedido of pagina.pedidos) {
      await ingerirPedidoComRegistroDeErro(
        tarefa.contaCanalId,
        tarefa.userId,
        tarefa.canal,
        pedido.pedidoExternoId,
        "PEDIDOS_INCREMENTAL"
      );
      processadosNoLote++;
    }
    cursor = pagina.cursor;

    if (!pagina.temMais) {
      await prisma.mercadoLivreAccount.update({
        where: { id: tarefa.contaCanalId },
        data: { ultimaSincronizacaoFinanceiraEm: new Date() },
      });
      await prisma.tarefaSincronizacaoFinanceira.update({
        where: { id: tarefa.id },
        data: {
          status: StatusTarefaSincronizacao.CONCLUIDA,
          concluidaEm: new Date(),
          bloqueadaAte: null,
          processados: { increment: processadosNoLote },
        },
      });
      return { tarefaId: tarefa.id, tipo: tarefa.tipo, status: "CONCLUIDA", processados: processadosNoLote };
    }

    await prisma.tarefaSincronizacaoFinanceira.update({
      where: { id: tarefa.id },
      data: {
        cursor: { offset: cursor },
        processados: { increment: pagina.pedidos.length },
        bloqueadaAte: new Date(Date.now() + MINUTOS_TRAVA * 60 * 1000),
      },
    });
    processadosNoLote = 0;
  }

  await prisma.tarefaSincronizacaoFinanceira.update({
    where: { id: tarefa.id },
    data: { bloqueadaAte: null },
  });
  return { tarefaId: tarefa.id, tipo: tarefa.tipo, status: "EM_ANDAMENTO", processados: processadosNoLote };
}

async function executarAds(tarefa: TarefaSincronizacaoFinanceira): Promise<ResultadoExecucaoFila> {
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
  return { tarefaId: tarefa.id, tipo: tarefa.tipo, status: "CONCLUIDA", processados };
}

async function executarCobrancas(tarefa: TarefaSincronizacaoFinanceira): Promise<ResultadoExecucaoFila> {
  const desde = tarefa.desde ?? new Date();
  const ate = tarefa.ate ?? new Date();

  let processados = 0;
  let cursorMes = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), 1));
  const fimMes = new Date(Date.UTC(ate.getUTCFullYear(), ate.getUTCMonth(), 1));
  while (cursorMes <= fimMes) {
    const resultado = await ingerirCobrancasDoMes(tarefa.contaCanalId, mesReferenciaDe(cursorMes));
    processados += resultado.processadas;
    cursorMes = new Date(Date.UTC(cursorMes.getUTCFullYear(), cursorMes.getUTCMonth() + 1, 1));
  }

  await prisma.tarefaSincronizacaoFinanceira.update({
    where: { id: tarefa.id },
    data: { status: StatusTarefaSincronizacao.CONCLUIDA, concluidaEm: new Date(), bloqueadaAte: null, processados },
  });
  return { tarefaId: tarefa.id, tipo: tarefa.tipo, status: "CONCLUIDA", processados };
}

async function executarTarefa(
  tarefa: TarefaSincronizacaoFinanceira,
  orcamentoMs: number
): Promise<ResultadoExecucaoFila> {
  switch (tarefa.tipo) {
    case TipoTarefaSincronizacao.PEDIDOS_PERIODO:
      return executarPedidosPeriodo(tarefa, orcamentoMs);
    case TipoTarefaSincronizacao.PEDIDOS_INCREMENTAL:
      return executarPedidosIncremental(tarefa, orcamentoMs);
    case TipoTarefaSincronizacao.ADS:
      return executarAds(tarefa);
    case TipoTarefaSincronizacao.COBRANCAS:
      return executarCobrancas(tarefa);
    default:
      await prisma.tarefaSincronizacaoFinanceira.update({
        where: { id: tarefa.id },
        data: {
          status: StatusTarefaSincronizacao.ERRO,
          erro: `Tipo de tarefa ainda não implementado: ${tarefa.tipo}`,
          bloqueadaAte: null,
        },
      });
      return { tarefaId: tarefa.id, tipo: tarefa.tipo, status: "ERRO", processados: 0 };
  }
}

export async function executarFila(
  userId: string,
  contaCanalId: string,
  orcamentoMs: number = tempoMaximoLoteMs()
): Promise<ResultadoExecucaoFila> {
  const tarefa = await obterProximaTarefa(userId, contaCanalId);
  if (!tarefa) return { tarefaId: null, tipo: null, status: "OCIOSO", processados: 0 };

  await prisma.tarefaSincronizacaoFinanceira.update({
    where: { id: tarefa.id },
    data: {
      status: StatusTarefaSincronizacao.EM_ANDAMENTO,
      bloqueadaAte: new Date(Date.now() + MINUTOS_TRAVA * 60 * 1000),
    },
  });

  try {
    return await executarTarefa(tarefa, orcamentoMs);
  } catch (erro) {
    await prisma.tarefaSincronizacaoFinanceira.update({
      where: { id: tarefa.id },
      data: {
        status: StatusTarefaSincronizacao.PENDENTE,
        tentativas: { increment: 1 },
        erro: mensagemDeErro(erro),
        bloqueadaAte: null,
      },
    });
    return { tarefaId: tarefa.id, tipo: tarefa.tipo, status: "ERRO", processados: 0 };
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
