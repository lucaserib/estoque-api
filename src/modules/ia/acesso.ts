import { StatusIaAssinatura, type Subscription } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DIAS_TESTE, contasLiberadasPorEnv, iaConfigurada, iaDesligada } from "./config";
import { IaIndisponivelError } from "./erros";
import { type ConsumoIa, obterConsumoDoMes, verificarOrcamento } from "./uso";

const DIA_MS = 24 * 60 * 60 * 1000;

export type OrigemAcessoIa = "ASSINATURA" | "TESTE" | "MANUAL" | "ENV";

export interface AcessoIa {
  configurada: boolean;
  desligada: boolean;
  liberada: boolean;
  origem: OrigemAcessoIa | null;
  status: StatusIaAssinatura;
  testeAteEm: string | null;
  testeDisponivel: boolean;
  periodoFim: string | null;
  consumo: ConsumoIa;
}

type AssinaturaIa = Pick<
  Subscription,
  "iaStatus" | "iaLiberadaManual" | "iaPeriodoFim" | "iaTesteIniciadoEm" | "iaOrcamentoCentavos"
>;

export function fimDoTeste(assinatura: Pick<AssinaturaIa, "iaTesteIniciadoEm"> | null): Date | null {
  return assinatura?.iaTesteIniciadoEm ? new Date(assinatura.iaTesteIniciadoEm.getTime() + DIAS_TESTE * DIA_MS) : null;
}

export function assinaturaIaVigente(assinatura: Pick<AssinaturaIa, "iaStatus" | "iaPeriodoFim"> | null, agora: Date): boolean {
  if (!assinatura) return false;
  if (assinatura.iaStatus === StatusIaAssinatura.ATIVA) return true;
  const pagoAte = assinatura.iaPeriodoFim?.getTime() ?? 0;
  return (
    (assinatura.iaStatus === StatusIaAssinatura.CANCELADA || assinatura.iaStatus === StatusIaAssinatura.PENDENTE) &&
    pagoAte > agora.getTime()
  );
}

export function determinarOrigem(
  assinatura: AssinaturaIa | null,
  liberadaPorEnv: boolean,
  agora: Date
): OrigemAcessoIa | null {
  if (liberadaPorEnv) return "ENV";
  if (assinatura?.iaLiberadaManual) return "MANUAL";
  if (assinaturaIaVigente(assinatura, agora)) return "ASSINATURA";
  const fim = fimDoTeste(assinatura);
  if (fim && fim.getTime() > agora.getTime()) return "TESTE";
  return null;
}

export async function obterAcessoIa(contaId: string, agora: Date = new Date()): Promise<AcessoIa> {
  const [assinatura, dono] = await Promise.all([
    prisma.subscription.findUnique({
      where: { userId: contaId },
      select: {
        iaStatus: true,
        iaLiberadaManual: true,
        iaPeriodoFim: true,
        iaTesteIniciadoEm: true,
        iaOrcamentoCentavos: true,
      },
    }),
    prisma.user.findUnique({ where: { id: contaId }, select: { email: true } }),
  ]);

  const liberadasEnv = contasLiberadasPorEnv();
  const liberadaPorEnv =
    liberadasEnv.has(contaId.toLowerCase()) || Boolean(dono?.email && liberadasEnv.has(dono.email.toLowerCase()));
  const origem = determinarOrigem(assinatura, liberadaPorEnv, agora);
  const fimTeste = fimDoTeste(assinatura);

  const consumo = await obterConsumoDoMes(contaId, {
    agora,
    testeIniciadoEm: origem === "TESTE" ? assinatura?.iaTesteIniciadoEm ?? null : null,
    orcamentoCentavos: assinatura?.iaOrcamentoCentavos ?? null,
  });

  return {
    configurada: iaConfigurada(),
    desligada: iaDesligada(),
    liberada: origem !== null,
    origem,
    status: assinatura?.iaStatus ?? StatusIaAssinatura.INATIVA,
    testeAteEm: fimTeste ? fimTeste.toISOString() : null,
    testeDisponivel: !assinatura?.iaTesteIniciadoEm && origem === null,
    periodoFim: assinatura?.iaPeriodoFim ? assinatura.iaPeriodoFim.toISOString() : null,
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
  if (!acesso.liberada) {
    throw new IaIndisponivelError("O Skubo IA é um recurso do plano com IA.", "NAO_CONTRATADA");
  }
  verificarOrcamento(acesso.consumo);
  return acesso;
}

export async function garantirOrcamento(contaId: string, agora: Date = new Date()): Promise<ConsumoIa> {
  const acesso = await obterAcessoIa(contaId, agora);
  verificarOrcamento(acesso.consumo);
  return acesso.consumo;
}
