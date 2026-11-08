import { PapelMensagemIa, RecursoIa } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fimDoMes, inicioDoMes } from "@/modules/financeiro/dominio/periodo";
import {
  DIAS_TESTE,
  TESTE_MENSAGENS_SEM_PRECO,
  cotacaoDolar,
  mensagensMensais,
  orcamentoMensalCentavos,
  precosConfigurados,
  precosDoModelo,
  testeOrcamentoCentavos,
} from "./config";
import { IaIndisponivelError } from "./erros";

const DIA_MS = 24 * 60 * 60 * 1000;
const RECURSOS_QUE_CONTAM_COMO_MENSAGEM = [RecursoIa.ANALISE_CONTROLE, RecursoIa.EXPLICACAO, RecursoIa.RESUMO_SEMANAL];

export interface UsoTokens {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

export function estimarCustoCentavos(modelo: string, uso: UsoTokens): number | null {
  const precos = precosDoModelo(modelo);
  if (!precos) return null;
  const dolares =
    (uso.input_tokens * precos.entrada +
      uso.output_tokens * precos.saida +
      (uso.cache_read_input_tokens ?? 0) * precos.cacheLeitura +
      (uso.cache_creation_input_tokens ?? 0) * precos.cacheEscrita) /
    1_000_000;
  return Math.round(dolares * cotacaoDolar() * 100);
}

export interface RegistroUsoIa {
  contaId: string;
  autorId: string | null;
  recurso: RecursoIa;
  modelo: string;
  uso: UsoTokens | null;
  duracaoMs: number;
  sucesso: boolean;
  codigoErro?: string | null;
}

export async function registrarUsoIa(registro: RegistroUsoIa): Promise<void> {
  const uso = registro.uso;
  if (process.env.NODE_ENV !== "test") {
    console.info("[IA_USO]", {
      conta: registro.contaId,
      autor: registro.autorId,
      recurso: registro.recurso,
      modelo: registro.modelo,
      tokensEntrada: uso?.input_tokens ?? 0,
      tokensSaida: uso?.output_tokens ?? 0,
      tokensCacheLeitura: uso?.cache_read_input_tokens ?? 0,
      duracaoMs: Math.round(registro.duracaoMs),
      sucesso: registro.sucesso,
      codigoErro: registro.codigoErro ?? null,
    });
  }
  try {
    await prisma.usoIa.create({
      data: {
        userId: registro.contaId,
        autorId: registro.autorId,
        recurso: registro.recurso,
        modelo: registro.modelo,
        tokensEntrada: uso?.input_tokens ?? 0,
        tokensSaida: uso?.output_tokens ?? 0,
        tokensCacheLeitura: uso?.cache_read_input_tokens ?? 0,
        tokensCacheEscrita: uso?.cache_creation_input_tokens ?? 0,
        custoCentavos: uso ? estimarCustoCentavos(registro.modelo, uso) : null,
        duracaoMs: Math.max(0, Math.round(registro.duracaoMs)),
        sucesso: registro.sucesso,
        codigoErro: registro.codigoErro ?? null,
      },
    });
  } catch (error) {
    console.error("[IA_USO] Falha ao registrar uso", {
      conta: registro.contaId,
      recurso: registro.recurso,
      erro: error instanceof Error ? error.name : "desconhecido",
    });
  }
}

export interface ConsumoIa {
  base: "CUSTO" | "MENSAGENS";
  custoCentavos: number | null;
  mensagens: number;
  orcamentoCentavos: number;
  limiteMensagens: number;
  percentual: number;
  esgotado: boolean;
  desde: string;
  renovaEm: string;
}

export interface OpcoesConsumo {
  agora?: Date;
  testeIniciadoEm?: Date | null;
  orcamentoCentavos?: number | null;
}

export async function obterConsumoDoMes(contaId: string, opcoes: OpcoesConsumo = {}): Promise<ConsumoIa> {
  const agora = opcoes.agora ?? new Date();
  const emTeste = Boolean(opcoes.testeIniciadoEm);
  const desde = emTeste ? opcoes.testeIniciadoEm! : inicioDoMes(agora);
  const renovaEm = emTeste
    ? new Date(opcoes.testeIniciadoEm!.getTime() + DIAS_TESTE * DIA_MS)
    : new Date(fimDoMes(agora).getTime() + 1);

  const [custo, perguntas, outrosUsos] = await Promise.all([
    prisma.usoIa.aggregate({
      where: { userId: contaId, createdAt: { gte: desde } },
      _sum: { custoCentavos: true },
    }),
    prisma.mensagemIa.count({
      where: { papel: PapelMensagemIa.USUARIO, createdAt: { gte: desde }, conversa: { userId: contaId } },
    }),
    prisma.usoIa.count({
      where: {
        userId: contaId,
        createdAt: { gte: desde },
        sucesso: true,
        recurso: { in: RECURSOS_QUE_CONTAM_COMO_MENSAGEM },
      },
    }),
  ]);

  const base = precosConfigurados() ? "CUSTO" : "MENSAGENS";
  const orcamentoCentavos = emTeste ? testeOrcamentoCentavos() : opcoes.orcamentoCentavos ?? orcamentoMensalCentavos();
  const limiteMensagens = emTeste ? TESTE_MENSAGENS_SEM_PRECO : mensagensMensais();
  const custoCentavos = custo._sum.custoCentavos ?? (base === "CUSTO" ? 0 : null);
  const mensagens = perguntas + outrosUsos;
  const fracao =
    base === "CUSTO" ? (custoCentavos ?? 0) / Math.max(1, orcamentoCentavos) : mensagens / Math.max(1, limiteMensagens);

  return {
    base,
    custoCentavos,
    mensagens,
    orcamentoCentavos,
    limiteMensagens,
    percentual: Math.min(100, Math.round(fracao * 100)),
    esgotado: fracao >= 1,
    desde: desde.toISOString(),
    renovaEm: renovaEm.toISOString(),
  };
}

export function verificarOrcamento(consumo: ConsumoIa): void {
  if (!consumo.esgotado) return;
  const data = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(
    new Date(consumo.renovaEm)
  );
  throw new IaIndisponivelError(`Você usou todo o limite de IA do período. Ele renova em ${data}.`, "LIMITE");
}
