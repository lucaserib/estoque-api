import { prisma } from "@/lib/prisma";
import { obterConfiguracaoComercial } from "@/modules/comercial/configuracao";
import { garantirPerfilCliente } from "@/modules/clientes/perfil";
import { linkAbsoluto } from "@/modules/email/config";
import { ROTULOS_STATUS_INDICACAO, mascararNome } from "./comum";
import { diasPendentesDaConta, semanasGanhasPorIndicacao } from "./dias";
import { motivoParaNaoInformarCodigo } from "./convite";
import { descontoAnual, descontoMensal } from "./recompensa";

function proximoPasso(
  indicacao: { status: string; ativadoEm: Date | null; carenciaAte: Date | null },
  exigeMl: boolean
): { rotulo: string | null; passo: string | null } {
  switch (indicacao.status) {
    case "CADASTRADO":
      return { rotulo: null, passo: exigeMl ? "Falta conectar o Mercado Livre e assinar." : "Falta assinar." };
    case "ATIVADO":
      return { rotulo: null, passo: "Falta assinar." };
    case "EM_CARENCIA":
      if (exigeMl && !indicacao.ativadoEm) {
        return { rotulo: "Assinou · falta conectar o Mercado Livre", passo: "A recompensa sai quando a loja conectar o Mercado Livre." };
      }
      return { rotulo: null, passo: null };
    default:
      return { rotulo: null, passo: null };
  }
}

export async function painelIndicacao(contaId: string, usuarioId: string = contaId) {
  const [perfil, configuracao, indicacoes, semanas, diasPendentes, assinatura, sincronizou, resumo] = await Promise.all([
    garantirPerfilCliente(contaId),
    obterConfiguracaoComercial(),
    prisma.indicacao.findMany({ where: { indicadorContaId: contaId }, orderBy: { createdAt: "desc" }, take: 100 }),
    semanasGanhasPorIndicacao(contaId),
    diasPendentesDaConta(contaId),
    prisma.subscription.findUnique({
      where: { userId: contaId },
      select: { status: true, plan: true, precoContratadoCentavos: true, proximaCobrancaEm: true, currentPeriodEnd: true, descontoAplicadoCentavos: true },
    }),
    prisma.eventoProduto.findFirst({ where: { contaId, nome: "PRIMEIRA_SINCRONIZACAO" }, select: { id: true } }),
    prisma.analiseIa.findFirst({ where: { userId: contaId, tipo: "SEMANAL" }, select: { id: true } }),
  ]);

  const motivoCodigo = await motivoParaNaoInformarCodigo({ id: usuarioId, contaId });
  const indicados = await prisma.user.findMany({
    where: { id: { in: indicacoes.map((i) => i.indicadoContaId) } },
    select: { id: true, name: true, email: true },
  });
  const porId = new Map(indicados.map((u) => [u.id, u]));

  let proximaCobranca: { data: string; precoCentavos: number; descontoCentavos: number } | null = null;
  if (assinatura?.status === "ACTIVE" && assinatura.precoContratadoCentavos) {
    const data = assinatura.proximaCobrancaEm ?? assinatura.currentPeriodEnd;
    const preco = assinatura.precoContratadoCentavos;
    const desconto =
      assinatura.descontoAplicadoCentavos ??
      (assinatura.plan === "ANNUAL" ? descontoAnual(preco, diasPendentes) : Math.min(descontoMensal(preco, diasPendentes), preco));
    if (data) proximaCobranca = { data: data.toISOString(), precoCentavos: preco, descontoCentavos: desconto };
  }

  return {
    codigo: perfil.codigoIndicacao,
    link: linkAbsoluto(`/r/${perfil.codigoIndicacao}`),
    regras: {
      ativo: configuracao.indicacao.ativo,
      diasRecompensa: configuracao.indicacao.diasRecompensa,
      carenciaDias: configuracao.indicacao.carenciaDias,
      bonusPerguntasIa: configuracao.indicacao.bonusIndicado.perguntasIa,
      exigeMlConectado: configuracao.indicacao.exigeMlConectado,
    },
    semanasGanhas: semanas,
    diasPendentes,
    proximaCobranca,
    momentos: { primeiraSincronizacao: Boolean(sincronizou), primeiroResumo: Boolean(resumo) },
    podeInformarCodigo: motivoCodigo === null,
    indicacoes: indicacoes.map((i) => {
      const pessoa = porId.get(i.indicadoContaId);
      const etapa = proximoPasso(i, configuracao.indicacao.exigeMlConectado);
      return {
        id: i.id,
        nome: mascararNome(pessoa?.name, pessoa?.email),
        status: i.status,
        rotuloStatus: etapa.rotulo ?? ROTULOS_STATUS_INDICACAO[i.status] ?? i.status,
        proximoPasso: etapa.passo,
        motivo: i.status === "INVALIDADA" ? i.motivoInvalidacao : null,
        carenciaAte: i.carenciaAte,
        createdAt: i.createdAt,
        recompensadaEm: i.recompensadaEm,
      };
    }),
  };
}
