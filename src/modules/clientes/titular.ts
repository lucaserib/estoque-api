import { prisma } from "@/lib/prisma";
import { lerPreferencias } from "./consentimento";

export async function exportarDadosDoTitular(userId: string) {
  const usuario = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      contaId: true,
      createdAt: true,
      emailVerificadoEm: true,
      preferencias: true,
      receberResumoIa: true,
    },
  });
  if (!usuario) throw new Error("Usuário não encontrado");

  const contaId = usuario.contaId ?? usuario.id;
  const souDono = !usuario.contaId;

  const [perfil, consentimentos, emails, eventos, solicitacoes] = await Promise.all([
    souDono ? prisma.perfilCliente.findUnique({ where: { contaId } }) : Promise.resolve(null),
    prisma.consentimentoRegistro.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { tipo: true, concedido: true, versaoTexto: true, origem: true, ip: true, userAgent: true, createdAt: true },
    }),
    prisma.emailEnviado.findMany({
      where: { OR: [{ userId }, { para: usuario.email.toLowerCase() }] },
      orderBy: { createdAt: "desc" },
      take: 1000,
      select: { modelo: true, categoria: true, para: true, status: true, createdAt: true, enviadoEm: true, abertoEm: true, clicadoEm: true },
    }),
    prisma.eventoProduto.findMany({
      where: souDono ? { contaId } : { userId },
      orderBy: { createdAt: "asc" },
      take: 5000,
      select: { nome: true, propriedades: true, createdAt: true },
    }),
    prisma.solicitacaoExclusao.findMany({
      where: { userId },
      select: { status: true, motivo: true, createdAt: true, executadaEm: true },
    }),
  ]);

  return {
    geradoEm: new Date().toISOString(),
    titular: {
      id: usuario.id,
      nome: usuario.name,
      email: usuario.email,
      papel: usuario.role,
      donoDaConta: souDono,
      contaId,
      criadoEm: usuario.createdAt,
      emailVerificadoEm: usuario.emailVerificadoEm,
      receberResumoIa: usuario.receberResumoIa,
    },
    preferencias: lerPreferencias(usuario.preferencias),
    perfilDaLoja: perfil
      ? {
          nomeLoja: perfil.nomeLoja,
          whatsapp: perfil.whatsapp,
          faixaPedidosMes: perfil.faixaPedidosMes,
          canais: perfil.canais,
          comoConheceu: perfil.comoConheceu,
          origem: {
            utmSource: perfil.utmSource,
            utmMedium: perfil.utmMedium,
            utmCampaign: perfil.utmCampaign,
            utmContent: perfil.utmContent,
            utmTerm: perfil.utmTerm,
            paginaEntrada: perfil.paginaEntrada,
            referrer: perfil.referrer,
            primeiroToqueEm: perfil.primeiroToqueEm,
          },
          codigoIndicacao: perfil.codigoIndicacao,
        }
      : null,
    consentimentos,
    emailsEnviados: emails,
    eventos,
    pedidosDeExclusao: solicitacoes,
  };
}
