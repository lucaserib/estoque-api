import type { StatusIndicacao } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ErroAdmin } from "@/helpers/verifyAdminPlataforma";
import { obterConfiguracaoComercial } from "@/modules/comercial/configuracao";
import { ROTULOS_STATUS_INDICACAO } from "@/modules/indicacao/comum";
import { concederRecompensa } from "@/modules/indicacao/fluxo";
import type { ResultadoAcao } from "./acoesConta";

export async function painelIndicacoesAdmin(status: StatusIndicacao | null) {
  const [indicacoes, porStatus, diasConcedidos, configuracao, aguardandoMl] = await Promise.all([
    prisma.indicacao.findMany({ where: status ? { status } : {}, orderBy: { createdAt: "desc" }, take: 300 }),
    prisma.indicacao.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.creditoDiasAssinatura.aggregate({ where: { origem: "INDICACAO" }, _sum: { dias: true } }),
    obterConfiguracaoComercial(),
    prisma.indicacao.count({ where: { status: "EM_CARENCIA", ativadoEm: null } }),
  ]);
  const ids = [...new Set(indicacoes.flatMap((i) => [i.indicadorContaId, i.indicadoContaId]))];
  const pessoas = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true, name: true } });
  const porId = new Map(pessoas.map((p) => [p.id, p]));

  const recompensadas = await prisma.indicacao.groupBy({
    by: ["indicadorContaId"],
    where: { status: "RECOMPENSADA" },
    _count: { _all: true },
    orderBy: { _count: { indicadorContaId: "desc" } },
    take: 10,
  });
  const indicadoresRanking = await prisma.user.findMany({
    where: { id: { in: recompensadas.map((r) => r.indicadorContaId) } },
    select: { id: true, email: true },
  });
  const emailRanking = new Map(indicadoresRanking.map((u) => [u.id, u.email]));
  const dias = diasConcedidos._sum.dias ?? 0;

  return {
    resumo: {
      porStatus: Object.fromEntries(porStatus.map((s) => [s.status, s._count._all])),
      diasConcedidos: dias,
      aguardandoMl: configuracao.indicacao.exigeMlConectado ? aguardandoMl : 0,
      custoReceitaAdiadaCentavos: Math.round((configuracao.precoMensalCentavos * dias) / 30),
    },
    ranking: recompensadas.map((r) => ({ contaId: r.indicadorContaId, email: emailRanking.get(r.indicadorContaId) ?? null, recompensadas: r._count._all })),
    indicacoes: indicacoes.map((i) => ({
      ...i,
      rotuloStatus:
        i.status === "EM_CARENCIA" && configuracao.indicacao.exigeMlConectado && !i.ativadoEm
          ? "Assinou · falta conectar o Mercado Livre"
          : ROTULOS_STATUS_INDICACAO[i.status] ?? i.status,
      indicador: porId.get(i.indicadorContaId)?.email ?? null,
      indicado: porId.get(i.indicadoContaId)?.email ?? null,
    })),
  };
}

export async function decidirIndicacao(
  id: string,
  decisao: "aprovar" | "invalidar",
  contexto: { adminEmail: string; motivo: string }
): Promise<ResultadoAcao> {
  const indicacao = await prisma.indicacao.findUnique({ where: { id } });
  if (!indicacao) throw new ErroAdmin("Indicação não encontrada", 404);

  if (decisao === "invalidar") {
    if (indicacao.status === "RECOMPENSADA") throw new ErroAdmin("A recompensa já foi liberada; ajuste os dias direto na conta se precisar.");
    await prisma.indicacao.update({ where: { id }, data: { status: "INVALIDADA", motivoInvalidacao: `Equipe Skubo: ${contexto.motivo}`.slice(0, 500) } });
  } else {
    if (indicacao.status === "RECOMPENSADA") throw new ErroAdmin("Esta indicação já foi recompensada.");
    await prisma.indicacao.update({ where: { id }, data: { aprovadaManualmentePor: contexto.adminEmail, motivoInvalidacao: null } });
    await concederRecompensa({ ...indicacao, aprovadaManualmentePor: contexto.adminEmail });
  }

  return {
    resultado: { status: decisao === "aprovar" ? "RECOMPENSADA" : "INVALIDADA" },
    auditoria: {
      acao: decisao === "aprovar" ? "INDICACAO_APROVADA" : "INDICACAO_INVALIDADA",
      alvoTipo: "INDICACAO",
      alvoId: id,
      antes: { status: indicacao.status, motivo: indicacao.motivoInvalidacao },
      depois: { status: decisao === "aprovar" ? "RECOMPENSADA" : "INVALIDADA" },
    },
  };
}
