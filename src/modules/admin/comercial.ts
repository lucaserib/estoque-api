import { prisma } from "@/lib/prisma";
import { inicioDoMes } from "@/modules/financeiro/dominio/periodo";

const DIA_MS = 24 * 60 * 60 * 1000;

export interface PagamentoAssinaturaResumo {
  contaId: string;
  valorCentavos: number;
  aprovadoEm: Date;
  plano: "MONTHLY" | "ANNUAL" | null;
}

export function mrrReal(pagamentos: PagamentoAssinaturaResumo[], agora: Date): { mrrCentavos: number; pagantes: number } {
  const ultimoPorConta = new Map<string, PagamentoAssinaturaResumo>();
  for (const pagamento of pagamentos) {
    const atual = ultimoPorConta.get(pagamento.contaId);
    if (!atual || atual.aprovadoEm < pagamento.aprovadoEm) ultimoPorConta.set(pagamento.contaId, pagamento);
  }
  let mrrCentavos = 0;
  let pagantes = 0;
  for (const pagamento of ultimoPorConta.values()) {
    const idadeDias = (agora.getTime() - pagamento.aprovadoEm.getTime()) / DIA_MS;
    if (pagamento.plano === "ANNUAL") {
      if (idadeDias > 366) continue;
      mrrCentavos += pagamento.valorCentavos / 12;
    } else {
      if (idadeDias > 35) continue;
      mrrCentavos += pagamento.valorCentavos;
    }
    pagantes++;
  }
  return { mrrCentavos: Math.round(mrrCentavos), pagantes };
}

export function inicioDaSemana(data: Date): Date {
  const dia = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()));
  const semana = dia.getUTCDay() || 7;
  dia.setUTCDate(dia.getUTCDate() - semana + 1);
  return dia;
}

export function coortesSemanais(
  cadastros: Array<{ contaId: string; criadaEm: Date }>,
  assinaram: Set<string>,
  agora: Date,
  semanas = 8
) {
  const inicio = inicioDaSemana(new Date(agora.getTime() - (semanas - 1) * 7 * DIA_MS));
  const grupos = new Map<string, { cadastros: number; assinaram: number }>();
  for (let i = 0; i < semanas; i++) {
    grupos.set(new Date(inicio.getTime() + i * 7 * DIA_MS).toISOString().slice(0, 10), { cadastros: 0, assinaram: 0 });
  }
  for (const cadastro of cadastros) {
    const chave = inicioDaSemana(cadastro.criadaEm).toISOString().slice(0, 10);
    const grupo = grupos.get(chave);
    if (!grupo) continue;
    grupo.cadastros++;
    if (assinaram.has(cadastro.contaId)) grupo.assinaram++;
  }
  return [...grupos.entries()].map(([semana, g]) => ({
    semana,
    cadastros: g.cadastros,
    assinaram: g.assinaram,
    conversao: g.cadastros > 0 ? g.assinaram / g.cadastros : null,
  }));
}

function contarPor<T>(itens: T[], chave: (item: T) => string | null | undefined): Array<{ chave: string; total: number }> {
  const mapa = new Map<string, number>();
  for (const item of itens) {
    const valor = chave(item) || "(sem informação)";
    mapa.set(valor, (mapa.get(valor) ?? 0) + 1);
  }
  return [...mapa.entries()].map(([k, total]) => ({ chave: k, total })).sort((a, b) => b.total - a.total);
}

export async function contasDeTesteInterno(): Promise<Set<string>> {
  const internas = await prisma.perfilCliente.findMany({ where: { testeInterno: true }, select: { contaId: true } });
  return new Set(internas.map((p) => p.contaId));
}

export async function calcularMetricasComerciais(agora: Date = new Date()) {
  const internas = await contasDeTesteInterno();
  const fora = { notIn: [...internas] };
  const mes = inicioDoMes(agora);
  const ha56 = new Date(inicioDaSemana(agora).getTime() - 7 * 7 * DIA_MS);
  const ha366 = new Date(agora.getTime() - 366 * DIA_MS);

  const [donos, eventos, pagamentosAssinatura, assinaturas, pagamentosCredito, custoIa, indicacoesPagas, cancelamentosMes, perfis] =
    await Promise.all([
      prisma.user.findMany({
        where: { contaId: null, id: fora, createdAt: { gte: ha56 < mes ? ha56 : mes } },
        select: { id: true, createdAt: true },
      }),
      prisma.eventoProduto.findMany({
        where: {
          contaId: fora,
          nome: { in: ["EMAIL_VERIFICADO", "ML_CONECTADO", "PRIMEIRA_REPOSICAO_VISTA", "ASSINOU"] },
        },
        select: { contaId: true, nome: true },
      }),
      prisma.pagamentoPlataforma.findMany({
        where: { tipo: "ASSINATURA", status: "approved", aprovadoEm: { gte: ha366 }, contaId: fora },
        select: { contaId: true, valorCentavos: true, aprovadoEm: true },
      }),
      prisma.subscription.findMany({ where: { userId: fora }, select: { userId: true, plan: true, status: true, precoContratadoCentavos: true } }),
      prisma.pagamentoPlataforma.aggregate({
        where: { tipo: "CREDITO_IA", status: "approved", aprovadoEm: { gte: mes }, contaId: fora },
        _sum: { valorCentavos: true },
        _count: { _all: true },
      }),
      prisma.usoIa.aggregate({
        where: { createdAt: { gte: mes }, recurso: { not: "MARKETING_ADMIN" }, userId: fora },
        _sum: { custoCentavos: true },
      }),
      prisma.indicacao.count({ where: { status: { in: ["PAGOU", "EM_CARENCIA", "RECOMPENSADA"] }, indicadoContaId: fora } }),
      prisma.eventoProduto.findMany({ where: { nome: "CANCELOU", createdAt: { gte: mes }, contaId: fora }, select: { contaId: true } }),
      prisma.perfilCliente.findMany({
        where: { contaId: fora },
        select: { contaId: true, utmSource: true, comoConheceu: true, createdAt: true },
      }),
    ]);

  const planoPorConta = new Map(assinaturas.map((a) => [a.userId, a.plan]));
  const { mrrCentavos, pagantes } = mrrReal(
    pagamentosAssinatura
      .filter((p): p is typeof p & { aprovadoEm: Date } => Boolean(p.aprovadoEm))
      .map((p) => ({ ...p, plano: planoPorConta.get(p.contaId) ?? null })),
    agora
  );

  const conjuntos = new Map<string, Set<string>>();
  for (const evento of eventos) {
    if (!conjuntos.has(evento.nome)) conjuntos.set(evento.nome, new Set());
    conjuntos.get(evento.nome)!.add(evento.contaId);
  }
  const doMes = donos.filter((d) => d.createdAt >= mes);
  const tem = (nome: string, conta: string) => conjuntos.get(nome)?.has(conta) ?? false;

  const assinaram = conjuntos.get("ASSINOU") ?? new Set<string>();
  const precoPorConta = new Map(assinaturas.map((a) => [a.userId, a.precoContratadoCentavos ?? 0]));
  const canceladas = new Set(cancelamentosMes.map((c) => c.contaId));
  const ativasAgora = assinaturas.filter((a) => a.status === "ACTIVE").length;
  const baseInicioMes = ativasAgora + canceladas.size;
  const mrrPerdido = [...canceladas].reduce((t, conta) => {
    const plano = planoPorConta.get(conta);
    const preco = precoPorConta.get(conta) ?? 0;
    return t + (plano === "ANNUAL" ? preco / 12 : preco);
  }, 0);

  const receitaCreditos = pagamentosCredito._sum.valorCentavos ?? 0;
  const custoIaCentavos = custoIa._sum.custoCentavos ?? 0;
  const indicados = new Set(
    (await prisma.indicacao.findMany({ where: { indicadoContaId: fora }, select: { indicadoContaId: true } })).map((i) => i.indicadoContaId)
  );

  return {
    geradoEm: agora.toISOString(),
    funil: {
      cadastros: doMes.length,
      emailVerificado: doMes.filter((d) => tem("EMAIL_VERIFICADO", d.id)).length,
      mlConectado: doMes.filter((d) => tem("ML_CONECTADO", d.id)).length,
      primeiraReposicao: doMes.filter((d) => tem("PRIMEIRA_REPOSICAO_VISTA", d.id)).length,
      assinaram: doMes.filter((d) => assinaram.has(d.id)).length,
    },
    coortes: coortesSemanais(
      donos.map((d) => ({ contaId: d.id, criadaEm: d.createdAt })),
      assinaram,
      agora
    ),
    receita: {
      mrrCentavos,
      arrCentavos: mrrCentavos * 12,
      pagantes,
      arpaCentavos: pagantes > 0 ? Math.round(mrrCentavos / pagantes) : 0,
      churnLogo: baseInicioMes > 0 ? canceladas.size / baseInicioMes : null,
      churnReceita: mrrCentavos + mrrPerdido > 0 ? mrrPerdido / (mrrCentavos + mrrPerdido) : null,
    },
    creditos: {
      receitaMesCentavos: receitaCreditos,
      vendasMes: pagamentosCredito._count._all,
      custoIaMesCentavos: custoIaCentavos,
      margemMesCentavos: receitaCreditos - custoIaCentavos,
    },
    origem: {
      cadastrosPorUtm: contarPor(perfis.filter((p) => p.createdAt >= mes), (p) => p.utmSource),
      cadastrosPorComoConheceu: contarPor(perfis.filter((p) => p.createdAt >= mes), (p) => p.comoConheceu),
      cadastrosPorIndicacao: perfis.filter((p) => p.createdAt >= mes && indicados.has(p.contaId)).length,
      assinaturasPorUtm: contarPor(perfis.filter((p) => assinaram.has(p.contaId)), (p) => p.utmSource),
      assinaturasPorComoConheceu: contarPor(perfis.filter((p) => assinaram.has(p.contaId)), (p) => p.comoConheceu),
    },
    fatorIndicacao: pagantes > 0 ? indicacoesPagas / pagantes : null,
  };
}

export type MetricasComerciais = Awaited<ReturnType<typeof calcularMetricasComerciais>>;
