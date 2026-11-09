import { NotificationType, type Prisma, RecursoIa, TipoAnaliseIa, UserRole } from "@prisma/client";
import { contasSuspensasHaMaisDe } from "@/modules/conta/situacao";
import { prisma } from "@/lib/prisma";
import { gerarDiagnostico } from "@/modules/controle/diagnostico";
import { INSTRUCOES_ANALISE, executarAnaliseEstruturada, problemasDoDiagnostico } from "@/modules/controle/analiseIa";
import { fimDaSemana, formatarDataHoraBrasilia, inicioDaSemana } from "@/modules/financeiro/dominio/periodo";
import { calcularIndicadores } from "@/modules/financeiro/relatorios/motor";
import { obterAcessoIa } from "./acesso";
import { cobrarUsoIa } from "./consumo";
import { SemCreditosIaError } from "./creditos";
import { obterConfiguracaoComercial } from "@/modules/comercial/configuracao";
import type { ProvedorIa } from "./cliente";
import { contasLiberadasPorEnv, iaConfigurada, iaDesligada } from "./config";
import { resumirIndicadores } from "./ferramentas/financeiro";

const DIA_MS = 24 * 60 * 60 * 1000;
const TAMANHO_DO_LOTE = 4;
export const ORCAMENTO_PADRAO_MS = 45_000;

export interface SemanaResumo {
  inicio: Date;
  fim: Date;
}

export function semanaAnterior(agora: Date): SemanaResumo {
  const umaSemanaAtras = new Date(agora.getTime() - 7 * DIA_MS);
  return { inicio: inicioDaSemana(umaSemanaAtras), fim: fimDaSemana(umaSemanaAtras) };
}

export async function contasElegiveisResumo(agora: Date): Promise<string[]> {
  const liberadasEnv = contasLiberadasPorEnv();
  const configuracao = await obterConfiguracaoComercial();
  const [assinaturas, porEnv, comSaldo] = await Promise.all([
    prisma.subscription.findMany({
      where: { OR: [{ iaLiberadaManual: true }, { status: "ACTIVE" }] },
      select: { userId: true },
    }),
    liberadasEnv.size > 0
      ? prisma.user.findMany({
          where: {
            contaId: null,
            OR: [{ id: { in: [...liberadasEnv] } }, { email: { in: [...liberadasEnv], mode: "insensitive" } }],
          },
          select: { id: true },
        })
      : Promise.resolve([] as Array<{ id: string }>),
    configuracao.iaResumoSemanalSoAssinantes
      ? Promise.resolve([] as Array<{ contaId: string }>)
      : prisma.loteCreditoIa.findMany({
          where: { validoAte: { gt: agora }, quantidadeRestante: { gt: 0 } },
          select: { contaId: true },
          distinct: ["contaId"],
        }),
  ]);

  const elegiveis = new Set([...porEnv.map((u) => u.id), ...assinaturas.map((a) => a.userId), ...comSaldo.map((l) => l.contaId)]);
  const suspensas = await contasSuspensasHaMaisDe([...elegiveis], 3, agora);
  return [...elegiveis].filter((id) => !suspensas.has(id)).sort();
}

async function montarDadosDaSemana(contaId: string, semana: SemanaResumo) {
  const anteriorInicio = new Date(semana.inicio.getTime() - 7 * DIA_MS);
  const anteriorFim = new Date(semana.inicio.getTime() - 1);
  const [diagnostico, semanaPassada, semanaRetrasada] = await Promise.all([
    gerarDiagnostico(contaId, true),
    calcularIndicadores(contaId, semana.inicio, semana.fim),
    calcularIndicadores(contaId, anteriorInicio, anteriorFim),
  ]);
  return {
    diagnostico,
    dados: {
      semana: { desde: formatarDataHoraBrasilia(semana.inicio).slice(0, 10), ate: formatarDataHoraBrasilia(semana.fim).slice(0, 10) },
      notaSaudeDados: diagnostico.nota,
      contexto: diagnostico.contexto,
      semanaPassada: resumirIndicadores(semanaPassada),
      semanaAnterior: resumirIndicadores(semanaRetrasada),
      problemas: problemasDoDiagnostico(diagnostico),
    },
  };
}

export type ResultadoConta = "GERADO" | "JA_FEITO" | "SEM_ORCAMENTO" | "FALHA";

export async function gerarResumoSemanalConta(
  contaId: string,
  semana: SemanaResumo,
  provedor?: ProvedorIa
): Promise<ResultadoConta> {
  const existente = await prisma.analiseIa.findFirst({
    where: { userId: contaId, tipo: TipoAnaliseIa.SEMANAL, periodoInicio: semana.inicio },
    select: { id: true },
  });
  if (existente) return "JA_FEITO";

  const acesso = await obterAcessoIa(contaId);
  if (acesso.consumo.esgotado) return "SEM_ORCAMENTO";
  const pagante = acesso.ilimitada || acesso.statusConta === "ATIVA";
  try {
    await cobrarUsoIa({
      contaId,
      autorId: null,
      recurso: RecursoIa.RESUMO_SEMANAL,
      chave: `resumo-semanal:${contaId}:${semana.inicio.toISOString()}`,
      ilimitada: pagante,
      descricao: "Resumo semanal",
    });
  } catch (error) {
    if (error instanceof SemCreditosIaError) return "SEM_ORCAMENTO";
    throw error;
  }

  const { diagnostico, dados } = await montarDadosDaSemana(contaId, semana);
  const { conteudo, modelo, uso } = await executarAnaliseEstruturada({
    contaId,
    autorId: null,
    recurso: RecursoIa.RESUMO_SEMANAL,
    instrucoes: INSTRUCOES_ANALISE,
    pedido:
      "Este é o resumo semanal da loja (segunda de manhã). Compare a semana passada com a anterior e devolva exatamente 3 prioridades para esta semana, mais os riscos.",
    dados,
    maxPrioridades: 3,
    provedor,
  });

  await prisma.analiseIa.create({
    data: {
      userId: contaId,
      solicitadoPorId: contaId,
      tipo: TipoAnaliseIa.SEMANAL,
      periodoInicio: semana.inicio,
      periodoFim: semana.fim,
      modelo,
      notaDiagnostico: diagnostico.nota,
      conteudo: conteudo as unknown as Prisma.InputJsonValue,
      tokensEntrada: uso.input_tokens,
      tokensSaida: uso.output_tokens,
    },
  });

  const destinatarios = await prisma.user.findMany({
    where: { OR: [{ id: contaId }, { contaId }], role: UserRole.ADMIN, receberResumoIa: true },
    select: { id: true },
  });
  if (destinatarios.length > 0) {
    const resumo = conteudo.resumo.trim();
    await prisma.notification.createMany({
      data: destinatarios.map((u) => ({
        userId: u.id,
        type: NotificationType.RESUMO_IA,
        title: "Resumo semanal da sua loja",
        body: resumo.length > 180 ? `${resumo.slice(0, 177).trimEnd()}…` : resumo || "As 3 prioridades da semana estão prontas.",
        link: "/controle",
      })),
    });
  }
  return "GERADO";
}

export interface ResultadoResumoSemanal {
  semana: { inicio: string; fim: string };
  elegiveis: number;
  gerados: number;
  jaFeitos: number;
  semOrcamento: number;
  falhas: number;
  pendentes: number;
  completo: boolean;
}

export async function executarResumoSemanal(
  opcoes: { agora?: Date; orcamentoMs?: number; provedor?: ProvedorIa; relogio?: () => number } = {}
): Promise<ResultadoResumoSemanal> {
  const agora = opcoes.agora ?? new Date();
  const relogio = opcoes.relogio ?? Date.now;
  const inicio = relogio();
  const orcamento = opcoes.orcamentoMs ?? ORCAMENTO_PADRAO_MS;
  const semana = semanaAnterior(agora);
  const resultado: ResultadoResumoSemanal = {
    semana: { inicio: semana.inicio.toISOString(), fim: semana.fim.toISOString() },
    elegiveis: 0,
    gerados: 0,
    jaFeitos: 0,
    semOrcamento: 0,
    falhas: 0,
    pendentes: 0,
    completo: true,
  };
  if (iaDesligada() || !iaConfigurada()) return resultado;

  const contas = await contasElegiveisResumo(agora);
  resultado.elegiveis = contas.length;

  for (let i = 0; i < contas.length; i += TAMANHO_DO_LOTE) {
    if (relogio() - inicio > orcamento) {
      resultado.completo = false;
      resultado.pendentes = contas.length - i;
      break;
    }
    const lote = contas.slice(i, i + TAMANHO_DO_LOTE);
    const status = await Promise.allSettled(lote.map((contaId) => gerarResumoSemanalConta(contaId, semana, opcoes.provedor)));
    status.forEach((s, indice) => {
      if (s.status === "rejected") {
        resultado.falhas++;
        console.error("[IA_RESUMO_SEMANAL] Falha na conta", {
          conta: lote[indice],
          erro: s.reason instanceof Error ? s.reason.name : "desconhecido",
        });
      } else if (s.value === "GERADO") resultado.gerados++;
      else if (s.value === "JA_FEITO") resultado.jaFeitos++;
      else if (s.value === "SEM_ORCAMENTO") resultado.semOrcamento++;
    });
  }
  return resultado;
}
