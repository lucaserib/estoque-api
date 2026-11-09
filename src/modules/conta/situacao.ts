import type { Subscription } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isMercadoPagoConfigured } from "@/services/mercadoPagoService";
import { obterConfiguracaoComercial } from "@/modules/comercial/configuracao";
import { diasPendentesDaConta } from "@/modules/indicacao/dias";
import type { SituacaoConta, StatusConta } from "./tipos";

export type { SituacaoConta, StatusConta } from "./tipos";

const DIA_MS = 24 * 60 * 60 * 1000;
export const TOLERANCIA_INADIMPLENCIA_DIAS = 5;
const CACHE_MS = 30_000;

type AssinaturaParaSituacao = Pick<
  Subscription,
  "status" | "plan" | "trialEndsAt" | "currentPeriodEnd" | "updatedAt"
>;

interface DonoParaSituacao {
  name: string | null;
  email: string;
  bloqueadoEm: Date | null;
}

export function cobrancaObrigatoria(): boolean {
  const forcada = process.env.COBRANCA_OBRIGATORIA?.trim();
  if (forcada === "1") return true;
  if (forcada === "0") return false;
  return isMercadoPagoConfigured();
}

function somarDias(data: Date, dias: number): Date {
  return new Date(data.getTime() + dias * DIA_MS);
}

function diasAte(fim: Date, agora: Date): number {
  return Math.max(0, Math.ceil((fim.getTime() - agora.getTime()) / DIA_MS));
}

function avaliarStatus(
  assinatura: AssinaturaParaSituacao | null,
  dono: DonoParaSituacao | null,
  agora: Date
): { status: StatusConta; liberada: boolean; inativaDesde: Date | null } {
  if (dono?.bloqueadoEm) return { status: "BLOQUEADA", liberada: false, inativaDesde: dono.bloqueadoEm };
  if (!assinatura) return { status: "VENCIDA", liberada: false, inativaDesde: null };

  if (assinatura.status === "ACTIVE") return { status: "ATIVA", liberada: true, inativaDesde: null };

  if (assinatura.status === "PAST_DUE") {
    const limite = somarDias(assinatura.currentPeriodEnd ?? assinatura.updatedAt, TOLERANCIA_INADIMPLENCIA_DIAS);
    const liberada = limite.getTime() > agora.getTime();
    return { status: "INADIMPLENTE", liberada, inativaDesde: liberada ? null : limite };
  }

  if (assinatura.status === "CANCELED") {
    const fim = assinatura.currentPeriodEnd;
    const liberada = Boolean(fim && fim.getTime() > agora.getTime());
    return { status: "CANCELADA", liberada, inativaDesde: liberada ? null : fim ?? assinatura.updatedAt };
  }

  if (assinatura.trialEndsAt.getTime() > agora.getTime()) {
    return { status: "TESTE", liberada: true, inativaDesde: null };
  }
  return { status: "VENCIDA", liberada: false, inativaDesde: assinatura.trialEndsAt };
}

export function calcularSituacao(
  contaId: string,
  assinatura: AssinaturaParaSituacao | null,
  dono: DonoParaSituacao | null,
  agora: Date,
  opcoes: { cobrancaObrigatoria: boolean; diasDeCredito?: number }
): SituacaoConta {
  const { status, liberada, inativaDesde } = avaliarStatus(assinatura, dono, agora);
  const podeUsar = status === "BLOQUEADA" ? false : opcoes.cobrancaObrigatoria ? liberada : true;
  const emTeste = status === "TESTE";

  return {
    contaId,
    status,
    podeUsar,
    cobrancaObrigatoria: opcoes.cobrancaObrigatoria,
    plano: assinatura?.plan ?? null,
    testeTerminaEm: assinatura?.trialEndsAt ?? null,
    diasRestantesTeste: emTeste && assinatura ? diasAte(assinatura.trialEndsAt, agora) : null,
    periodoTerminaEm: assinatura?.currentPeriodEnd ?? null,
    inativaDesde: podeUsar ? null : inativaDesde,
    diasDeCredito: opcoes.diasDeCredito ?? 0,
    donoNome: dono?.name ?? null,
    donoEmail: dono?.email ?? null,
  };
}

export async function diasTesteVigentes(): Promise<number> {
  return (await obterConfiguracaoComercial()).diasTeste;
}

export async function criarAssinaturaDaConta(contaId: string, agora: Date = new Date()): Promise<Subscription> {
  const dias = await diasTesteVigentes();
  return prisma.subscription.upsert({
    where: { userId: contaId },
    update: {},
    create: { userId: contaId, status: "TRIALING", trialEndsAt: somarDias(agora, dias) },
  });
}

export async function obterSituacaoConta(contaId: string, agora: Date = new Date()): Promise<SituacaoConta> {
  const dono = await prisma.user.findUnique({
    where: { id: contaId },
    select: { name: true, email: true, bloqueadoEm: true, contaId: true, subscription: true },
  });

  let assinatura: Subscription | null = dono?.subscription ?? null;
  if (dono && !dono.contaId && !assinatura) assinatura = await criarAssinaturaDaConta(contaId, agora);

  return calcularSituacao(contaId, assinatura, dono, agora, {
    cobrancaObrigatoria: cobrancaObrigatoria(),
    diasDeCredito: await diasPendentesDaConta(contaId).catch(() => 0),
  });
}

const cache = new Map<string, { valor: SituacaoConta; expiraEm: number }>();

export async function obterSituacaoContaEmCache(contaId: string): Promise<SituacaoConta> {
  const agora = Date.now();
  const guardada = cache.get(contaId);
  if (guardada && guardada.expiraEm > agora) return guardada.valor;
  const valor = await obterSituacaoConta(contaId);
  cache.set(contaId, { valor, expiraEm: agora + CACHE_MS });
  return valor;
}

export function invalidarSituacaoConta(contaId?: string): void {
  if (contaId) cache.delete(contaId);
  else cache.clear();
}

export async function contasSuspensasHaMaisDe(
  contaIds: string[],
  dias: number,
  agora: Date = new Date()
): Promise<Set<string>> {
  const suspensas = new Set<string>();
  const unicas = [...new Set(contaIds)];
  if (unicas.length === 0) return suspensas;

  const donos = await prisma.user.findMany({
    where: { id: { in: unicas } },
    select: { id: true, name: true, email: true, bloqueadoEm: true, subscription: true },
  });
  const limite = agora.getTime() - dias * DIA_MS;

  for (const dono of donos) {
    const situacao = calcularSituacao(dono.id, dono.subscription, dono, agora, {
      cobrancaObrigatoria: cobrancaObrigatoria(),
    });
    if (!situacao.podeUsar && situacao.inativaDesde && situacao.inativaDesde.getTime() < limite) {
      suspensas.add(dono.id);
    }
  }
  return suspensas;
}
