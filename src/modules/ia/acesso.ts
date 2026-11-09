import { prisma } from "@/lib/prisma";
import { AssinaturaInativaError } from "@/modules/conta/erros";
import { obterSituacaoConta, type StatusConta } from "@/modules/conta/situacao";
import { obterConfiguracaoComercial, pacotesAtivos } from "@/modules/comercial/configuracao";
import { contasLiberadasPorEnv, iaConfigurada, iaDesligada } from "./config";
import { resumoCreditos } from "./creditos";
import { IaIndisponivelError } from "./erros";
import { type ConsumoIa, obterConsumoDoMes, verificarOrcamento } from "./uso";

export type OrigemAcessoIa = "CREDITOS" | "MANUAL" | "ENV";

export interface PacoteIaPublico {
  id: string;
  nome: string;
  perguntas: number;
  precoCentavos: number;
  destaque: boolean;
}

export interface AcessoIa {
  configurada: boolean;
  desligada: boolean;
  contaAtiva: boolean;
  statusConta: StatusConta;
  liberada: boolean;
  ilimitada: boolean;
  origem: OrigemAcessoIa | null;
  saldo: number;
  proximoVencimento: { quantidade: number; validoAte: string } | null;
  pacotes: PacoteIaPublico[];
  consumo: ConsumoIa;
}

export function determinarOrigem(
  liberadaPorEnv: boolean,
  liberadaManual: boolean,
  saldo: number
): OrigemAcessoIa | null {
  if (liberadaPorEnv) return "ENV";
  if (liberadaManual) return "MANUAL";
  if (saldo > 0) return "CREDITOS";
  return null;
}

export async function obterAcessoIa(contaId: string, agora: Date = new Date()): Promise<AcessoIa> {
  const [assinatura, dono, situacao, creditos, configuracao] = await Promise.all([
    prisma.subscription.findUnique({
      where: { userId: contaId },
      select: { iaLiberadaManual: true, iaOrcamentoCentavos: true },
    }),
    prisma.user.findUnique({ where: { id: contaId }, select: { email: true } }),
    obterSituacaoConta(contaId, agora),
    resumoCreditos(contaId, agora),
    obterConfiguracaoComercial(),
  ]);

  const liberadasEnv = contasLiberadasPorEnv();
  const liberadaPorEnv =
    liberadasEnv.has(contaId.toLowerCase()) || Boolean(dono?.email && liberadasEnv.has(dono.email.toLowerCase()));
  const origem = determinarOrigem(liberadaPorEnv, Boolean(assinatura?.iaLiberadaManual), creditos.saldo);
  const consumo = await obterConsumoDoMes(contaId, { agora, orcamentoCentavos: assinatura?.iaOrcamentoCentavos ?? null });

  return {
    configurada: iaConfigurada(),
    desligada: iaDesligada(),
    contaAtiva: situacao.podeUsar,
    statusConta: situacao.status,
    liberada: situacao.podeUsar && origem !== null,
    ilimitada: origem === "ENV" || origem === "MANUAL",
    origem,
    saldo: creditos.saldo,
    proximoVencimento: creditos.proximoVencimento
      ? { quantidade: creditos.proximoVencimento.quantidade, validoAte: creditos.proximoVencimento.validoAte.toISOString() }
      : null,
    pacotes: pacotesAtivos(configuracao).map(({ id, nome, perguntas, precoCentavos, destaque }) => ({
      id,
      nome,
      perguntas,
      precoCentavos,
      destaque,
    })),
    consumo,
  };
}

export async function garantirAcessoIa(contaId: string, agora: Date = new Date()): Promise<AcessoIa> {
  const acesso = await obterAcessoIa(contaId, agora);
  if (acesso.desligada) {
    throw new IaIndisponivelError("A IA está temporariamente desligada. Tente mais tarde.", "DESLIGADA");
  }
  if (!acesso.configurada) {
    throw new IaIndisponivelError("A IA ainda não foi configurada no servidor.", "NAO_CONFIGURADA");
  }
  if (!acesso.contaAtiva) throw new AssinaturaInativaError(acesso.statusConta);
  if (!acesso.liberada) {
    throw new IaIndisponivelError("As perguntas da Skubo IA da sua loja acabaram. Compre um pacote para continuar.", "SEM_CREDITOS");
  }
  verificarOrcamento(acesso.consumo);
  return acesso;
}

export async function garantirOrcamento(contaId: string, agora: Date = new Date()): Promise<ConsumoIa> {
  const assinatura = await prisma.subscription.findUnique({ where: { userId: contaId }, select: { iaOrcamentoCentavos: true } });
  const consumo = await obterConsumoDoMes(contaId, { agora, orcamentoCentavos: assinatura?.iaOrcamentoCentavos ?? null });
  verificarOrcamento(consumo);
  return consumo;
}
