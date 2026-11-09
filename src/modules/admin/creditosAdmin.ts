import { prisma } from "@/lib/prisma";
import { inicioDoMes } from "@/modules/financeiro/dominio/periodo";

const DIA_MS = 24 * 60 * 60 * 1000;

export async function metricasCreditosIa(agora: Date = new Date()) {
  const mes = inicioDoMes(agora);
  const ha30 = new Date(agora.getTime() - 30 * DIA_MS);
  const [compras, consumoMes, custoMes, perguntasCobradasMes, saldos, consumidores30d] = await Promise.all([
    prisma.compraCreditoIa.groupBy({
      by: ["pacoteId", "pacoteNome"],
      where: { status: "APROVADA" },
      _count: { _all: true },
      _sum: { precoCentavos: true, perguntas: true },
    }),
    prisma.movimentoCreditoIa.aggregate({ where: { tipo: "CONSUMO", createdAt: { gte: mes } }, _sum: { quantidade: true } }),
    prisma.usoIa.aggregate({
      where: { createdAt: { gte: mes }, recurso: { not: "MARKETING_ADMIN" }, sucesso: true },
      _sum: { custoCentavos: true },
      _count: { _all: true },
    }),
    prisma.movimentoCreditoIa.count({ where: { tipo: "CONSUMO", createdAt: { gte: mes } } }),
    prisma.loteCreditoIa.groupBy({
      by: ["contaId"],
      where: { validoAte: { gt: agora }, quantidadeRestante: { gt: 0 } },
      _sum: { quantidadeRestante: true },
    }),
    prisma.movimentoCreditoIa.findMany({ where: { tipo: "CONSUMO", createdAt: { gte: ha30 } }, select: { contaId: true }, distinct: ["contaId"] }),
  ]);

  const perguntasMes = -(consumoMes._sum.quantidade ?? 0);
  const custoMesCentavos = custoMes._sum.custoCentavos ?? 0;
  const custoPorPergunta = perguntasMes > 0 ? custoMesCentavos / perguntasMes : null;
  const ativos = new Set(consumidores30d.map((c) => c.contaId));
  const parados = saldos.filter((s) => !ativos.has(s.contaId));
  const donosParados = await prisma.user.findMany({
    where: { id: { in: parados.map((p) => p.contaId) } },
    select: { id: true, email: true, perfilCliente: { select: { nomeLoja: true } } },
  });
  const porId = new Map(donosParados.map((d) => [d.id, d]));

  return {
    pacotes: compras.map((c) => {
      const receita = c._sum.precoCentavos ?? 0;
      const perguntas = c._sum.perguntas ?? 0;
      const custoEstimado = custoPorPergunta !== null ? Math.round(custoPorPergunta * perguntas) : null;
      return {
        pacoteId: c.pacoteId,
        nome: c.pacoteNome,
        vendas: c._count._all,
        receitaCentavos: receita,
        perguntas,
        custoEstimadoCentavos: custoEstimado,
        margemCentavos: custoEstimado !== null ? receita - custoEstimado : null,
      };
    }),
    mes: {
      perguntasConsumidas: perguntasMes,
      chamadasIa: custoMes._count._all,
      perguntasCobradas: perguntasCobradasMes,
      custoCentavos: custoMesCentavos,
      custoPorPerguntaCentavos: custoPorPergunta !== null ? Math.round(custoPorPergunta * 100) / 100 : null,
    },
    saldoParado: parados
      .map((p) => ({
        contaId: p.contaId,
        email: porId.get(p.contaId)?.email ?? null,
        loja: porId.get(p.contaId)?.perfilCliente?.nomeLoja ?? null,
        saldo: p._sum.quantidadeRestante ?? 0,
      }))
      .sort((a, b) => b.saldo - a.saldo)
      .slice(0, 50),
    totalSaldoEmAberto: saldos.reduce((t, s) => t + (s._sum.quantidadeRestante ?? 0), 0),
  };
}
