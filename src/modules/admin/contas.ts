import { prisma } from "@/lib/prisma";
import { calcularSituacao, cobrancaObrigatoria, type StatusConta } from "@/modules/conta/situacao";
import { extratoCreditos, resumoCreditos } from "@/modules/ia/creditos";
import { mascararNome } from "@/modules/indicacao/comum";

export interface FiltrosContas {
  busca?: string | null;
  situacao?: StatusConta | null;
  plano?: "MONTHLY" | "ANNUAL" | "SEM" | null;
  origem?: string | null;
  ml?: boolean | null;
  bling?: boolean | null;
  saldoIa?: "com" | "sem" | null;
  de?: Date | null;
  ate?: Date | null;
  testeInterno?: boolean | null;
}

export interface LinhaConta {
  contaId: string;
  nome: string | null;
  email: string;
  loja: string | null;
  criadaEm: string;
  situacao: StatusConta;
  podeUsar: boolean;
  plano: "MONTHLY" | "ANNUAL" | null;
  precoContratadoCentavos: number | null;
  origem: string | null;
  indicada: boolean;
  ml: boolean;
  bling: boolean;
  saldoIa: number;
  iaLiberadaManual: boolean;
  membros: number;
  testeInterno: boolean;
  bloqueada: boolean;
  ultimoLoginEm: string | null;
}

export async function listarContas(filtros: FiltrosContas = {}, agora: Date = new Date()): Promise<LinhaConta[]> {
  const termo = filtros.busca?.trim();
  const donos = await prisma.user.findMany({
    where: {
      contaId: null,
      ...(termo
        ? {
            OR: [
              { email: { contains: termo, mode: "insensitive" } },
              { name: { contains: termo, mode: "insensitive" } },
              { perfilCliente: { nomeLoja: { contains: termo, mode: "insensitive" } } },
              { id: termo },
            ],
          }
        : {}),
      ...(filtros.de || filtros.ate
        ? { createdAt: { ...(filtros.de ? { gte: filtros.de } : {}), ...(filtros.ate ? { lte: filtros.ate } : {}) } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      bloqueadoEm: true,
      ultimoLoginEm: true,
      subscription: true,
      perfilCliente: { select: { nomeLoja: true, utmSource: true, comoConheceu: true, testeInterno: true } },
      MercadoLivreAccount: { where: { isActive: true }, select: { id: true } },
      BlingAccount: { where: { isActive: true }, select: { id: true } },
      _count: { select: { membros: true } },
    },
  });

  const ids = donos.map((d) => d.id);
  const [saldos, indicacoes] = await Promise.all([
    prisma.loteCreditoIa.groupBy({
      by: ["contaId"],
      where: { contaId: { in: ids }, validoAte: { gt: agora }, quantidadeRestante: { gt: 0 } },
      _sum: { quantidadeRestante: true },
    }),
    prisma.indicacao.findMany({ where: { indicadoContaId: { in: ids } }, select: { indicadoContaId: true } }),
  ]);
  const saldoPorConta = new Map(saldos.map((s) => [s.contaId, s._sum.quantidadeRestante ?? 0]));
  const indicadas = new Set(indicacoes.map((i) => i.indicadoContaId));
  const cobrar = cobrancaObrigatoria();

  const linhas: LinhaConta[] = donos.map((dono) => {
    const situacao = calcularSituacao(dono.id, dono.subscription, dono, agora, { cobrancaObrigatoria: cobrar });
    return {
      contaId: dono.id,
      nome: dono.name,
      email: dono.email,
      loja: dono.perfilCliente?.nomeLoja ?? null,
      criadaEm: dono.createdAt.toISOString(),
      situacao: situacao.status,
      podeUsar: situacao.podeUsar,
      plano: dono.subscription?.plan ?? null,
      precoContratadoCentavos: dono.subscription?.precoContratadoCentavos ?? null,
      origem: dono.perfilCliente?.utmSource ?? dono.perfilCliente?.comoConheceu ?? null,
      indicada: indicadas.has(dono.id),
      ml: dono.MercadoLivreAccount.length > 0,
      bling: dono.BlingAccount.length > 0,
      saldoIa: saldoPorConta.get(dono.id) ?? 0,
      iaLiberadaManual: Boolean(dono.subscription?.iaLiberadaManual),
      membros: dono._count.membros,
      testeInterno: Boolean(dono.perfilCliente?.testeInterno),
      bloqueada: Boolean(dono.bloqueadoEm),
      ultimoLoginEm: dono.ultimoLoginEm?.toISOString() ?? null,
    };
  });

  return linhas.filter((linha) => {
    if (filtros.situacao && linha.situacao !== filtros.situacao) return false;
    if (filtros.plano === "SEM" && linha.plano) return false;
    if (filtros.plano && filtros.plano !== "SEM" && linha.plano !== filtros.plano) return false;
    if (filtros.origem && (filtros.origem === "indicacao" ? !linha.indicada : linha.origem !== filtros.origem)) return false;
    if (filtros.ml !== undefined && filtros.ml !== null && linha.ml !== filtros.ml) return false;
    if (filtros.bling !== undefined && filtros.bling !== null && linha.bling !== filtros.bling) return false;
    if (filtros.saldoIa === "com" && linha.saldoIa <= 0) return false;
    if (filtros.saldoIa === "sem" && linha.saldoIa > 0) return false;
    if (filtros.testeInterno !== undefined && filtros.testeInterno !== null && linha.testeInterno !== filtros.testeInterno) return false;
    return true;
  });
}

export async function detalharConta(contaId: string, agora: Date = new Date()) {
  const dono = await prisma.user.findFirst({
    where: { id: contaId, contaId: null },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      emailVerificadoEm: true,
      bloqueadoEm: true,
      motivoBloqueio: true,
      ultimoLoginEm: true,
      subscription: true,
      perfilCliente: true,
      membros: {
        select: { id: true, name: true, email: true, role: true, createdAt: true, emailVerificadoEm: true, bloqueadoEm: true, ultimoLoginEm: true },
      },
      MercadoLivreAccount: { select: { nickname: true, mlUserId: true, isActive: true } },
      BlingAccount: { select: { blingCompanyId: true, isActive: true } },
    },
  });
  if (!dono) return null;

  const pessoas = [dono.id, ...dono.membros.map((m) => m.id)];
  const [
    resumo,
    extrato,
    compras,
    pagamentos,
    feitas,
    recebida,
    emails,
    eventos,
    consentimentos,
    motivos,
    auditoriaConta,
    auditoriaAdmin,
    exclusoes,
    creditosDias,
  ] = await Promise.all([
    resumoCreditos(contaId, agora),
    extratoCreditos(contaId, 1, 50),
    prisma.compraCreditoIa.findMany({ where: { contaId }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.pagamentoPlataforma.findMany({
      where: { contaId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, mpPaymentId: true, tipo: true, valorCentavos: true, status: true, metodo: true, aprovadoEm: true, createdAt: true, compraId: true },
    }),
    prisma.indicacao.findMany({ where: { indicadorContaId: contaId }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.indicacao.findUnique({ where: { indicadoContaId: contaId } }),
    prisma.emailEnviado.findMany({
      where: { OR: [{ contaId }, { userId: { in: pessoas } }] },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, para: true, modelo: true, categoria: true, status: true, erro: true, createdAt: true, abertoEm: true, clicadoEm: true, dados: true },
    }),
    prisma.eventoProduto.findMany({ where: { contaId }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.consentimentoRegistro.findMany({ where: { userId: { in: pessoas } }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.motivoCancelamento.findMany({ where: { contaId }, orderBy: { createdAt: "desc" } }),
    prisma.auditoriaConta.findMany({ where: { contaId }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.auditoriaAdmin.findMany({ where: { alvoId: { in: pessoas } }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.solicitacaoExclusao.findMany({ where: { contaId }, orderBy: { createdAt: "desc" } }),
    prisma.creditoDiasAssinatura.findMany({ where: { contaId }, orderBy: { createdAt: "desc" } }),
  ]);

  const nomesIndicados = await prisma.user.findMany({
    where: { id: { in: feitas.map((i) => i.indicadoContaId) } },
    select: { id: true, name: true, email: true },
  });
  const porId = new Map(nomesIndicados.map((u) => [u.id, u]));
  const situacao = calcularSituacao(dono.id, dono.subscription, dono, agora, { cobrancaObrigatoria: cobrancaObrigatoria() });

  return {
    conta: {
      id: dono.id,
      nome: dono.name,
      email: dono.email,
      criadaEm: dono.createdAt,
      emailVerificadoEm: dono.emailVerificadoEm,
      bloqueadoEm: dono.bloqueadoEm,
      motivoBloqueio: dono.motivoBloqueio,
      ultimoLoginEm: dono.ultimoLoginEm,
    },
    perfil: dono.perfilCliente,
    situacao,
    assinatura: dono.subscription,
    integracoes: { mercadoLivre: dono.MercadoLivreAccount, bling: dono.BlingAccount },
    membros: dono.membros,
    creditos: { ...resumo, extrato: extrato.itens, compras },
    pagamentos,
    indicacoes: {
      feitas: feitas.map((i) => ({ ...i, indicado: mascararNome(porId.get(i.indicadoContaId)?.name, porId.get(i.indicadoContaId)?.email), indicadoEmail: porId.get(i.indicadoContaId)?.email ?? null })),
      recebida,
      creditosDias,
    },
    emails: emails.map(({ dados, ...email }) => ({ ...email, podeReenviar: dados !== null })),
    eventos,
    consentimentos,
    motivosCancelamento: motivos,
    auditoria: { conta: auditoriaConta, admin: auditoriaAdmin },
    exclusoes,
  };
}
