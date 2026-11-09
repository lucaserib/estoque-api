import type { Indicacao } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { emailCanonico } from "./comum";

async function emailsDaConta(contaId: string): Promise<string[]> {
  const pessoas = await prisma.user.findMany({ where: { OR: [{ id: contaId }, { contaId }] }, select: { email: true } });
  return pessoas.map((p) => emailCanonico(p.email));
}

async function emailsPagadores(contaId: string): Promise<string[]> {
  const [assinatura, pagamentos] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId: contaId }, select: { mpPayerEmail: true } }),
    prisma.pagamentoPlataforma.findMany({ where: { contaId, emailPagador: { not: null } }, select: { emailPagador: true }, take: 50 }),
  ]);
  return [assinatura?.mpPayerEmail, ...pagamentos.map((p) => p.emailPagador)]
    .filter((e): e is string => Boolean(e))
    .map(emailCanonico);
}

async function contasMercadoLivre(contaId: string): Promise<string[]> {
  const [atuais, historico] = await Promise.all([
    prisma.mercadoLivreAccount.findMany({ where: { userId: contaId }, select: { mlUserId: true } }),
    prisma.eventoProduto.findMany({ where: { contaId, nome: "ML_CONECTADO" }, select: { propriedades: true } }),
  ]);
  const doHistorico = historico
    .map((e) => (e.propriedades as { mlUserId?: unknown } | null)?.mlUserId)
    .filter((id): id is string => typeof id === "string");
  return [...atuais.map((a) => a.mlUserId), ...doHistorico];
}

async function empresasBling(contaId: string): Promise<string[]> {
  const [atuais, historico] = await Promise.all([
    prisma.blingAccount.findMany({ where: { userId: contaId, blingCompanyId: { not: null } }, select: { blingCompanyId: true } }),
    prisma.eventoProduto.findMany({ where: { contaId, nome: "BLING_CONECTADO" }, select: { propriedades: true } }),
  ]);
  const doHistorico = historico
    .map((e) => (e.propriedades as { blingCompanyId?: unknown } | null)?.blingCompanyId)
    .filter((id): id is string => typeof id === "string");
  return [...atuais.map((a) => a.blingCompanyId!), ...doHistorico];
}

function cruzam(a: string[], b: string[]): boolean {
  const conjunto = new Set(a);
  return b.some((item) => conjunto.has(item));
}

export async function motivoDeFraude(
  indicacao: Pick<Indicacao, "id" | "indicadorContaId" | "indicadoContaId">,
  opcoes: { limiteRecompensasPorAno: number; agora?: Date }
): Promise<string | null> {
  const { indicadorContaId, indicadoContaId } = indicacao;
  if (indicadorContaId === indicadoContaId) return "Autoindicação: a conta indicou a si mesma.";

  const [perfilIndicador, perfilIndicado] = await Promise.all([
    prisma.perfilCliente.findUnique({ where: { contaId: indicadorContaId }, select: { whatsapp: true } }),
    prisma.perfilCliente.findUnique({ where: { contaId: indicadoContaId }, select: { whatsapp: true, testeInterno: true } }),
  ]);
  if (perfilIndicado?.testeInterno) return "A conta indicada é de teste interno.";

  const [emailsIndicador, emailsIndicado] = await Promise.all([emailsDaConta(indicadorContaId), emailsDaConta(indicadoContaId)]);
  if (cruzam(emailsIndicador, emailsIndicado)) return "Autoindicação: mesmo e-mail nas duas contas.";

  if (perfilIndicador?.whatsapp && perfilIndicador.whatsapp === perfilIndicado?.whatsapp) {
    return "Autoindicação: mesmo WhatsApp nas duas contas.";
  }

  const [pagadorIndicador, pagadorIndicado] = await Promise.all([emailsPagadores(indicadorContaId), emailsPagadores(indicadoContaId)]);
  if (cruzam([...pagadorIndicador, ...emailsIndicador], pagadorIndicado)) {
    return "Autoindicação: o pagamento saiu do mesmo e-mail de quem indicou.";
  }

  const [mlIndicador, mlIndicado] = await Promise.all([contasMercadoLivre(indicadorContaId), contasMercadoLivre(indicadoContaId)]);
  if (cruzam(mlIndicador, mlIndicado)) return "Autoindicação: a mesma conta do Mercado Livre está nas duas lojas.";

  const [blingIndicador, blingIndicado] = await Promise.all([empresasBling(indicadorContaId), empresasBling(indicadoContaId)]);
  if (cruzam(blingIndicador, blingIndicado)) return "Autoindicação: a mesma empresa do Bling está nas duas lojas.";

  const agora = opcoes.agora ?? new Date();
  const umAnoAtras = new Date(agora.getTime() - 365 * 24 * 60 * 60 * 1000);
  const recompensadas = await prisma.indicacao.count({
    where: { indicadorContaId, status: "RECOMPENSADA", recompensadaEm: { gte: umAnoAtras }, NOT: { id: indicacao.id } },
  });
  if (recompensadas >= opcoes.limiteRecompensasPorAno) {
    return `Limite de ${opcoes.limiteRecompensasPorAno} recompensas por ano atingido.`;
  }

  return null;
}
