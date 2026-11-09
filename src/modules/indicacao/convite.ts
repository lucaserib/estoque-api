import { prisma } from "@/lib/prisma";
import { obterConfiguracaoComercial } from "@/modules/comercial/configuracao";
import { normalizarCodigoIndicacao } from "@/modules/clientes/perfil";
import { registrarIndicacaoNoCadastro } from "./cadastro";

export const PRAZO_CODIGO_DEPOIS_DIAS = 14;
const DIA_MS = 24 * 60 * 60 * 1000;

export interface Convite {
  valido: boolean;
  codigo: string | null;
  convidadoPor: string | null;
  bonusPerguntasIa: number;
  diasTesteExtra: number;
}

const INVALIDO: Convite = { valido: false, codigo: null, convidadoPor: null, bonusPerguntasIa: 0, diasTesteExtra: 0 };

function primeiroNome(nome: string | null | undefined): string | null {
  const primeiro = nome?.trim().split(/\s+/)[0];
  return primeiro ? primeiro.slice(0, 40) : null;
}

export async function consultarConvite(codigoBruto: string | null | undefined): Promise<Convite> {
  const codigo = normalizarCodigoIndicacao(codigoBruto);
  if (!codigo) return INVALIDO;
  const configuracao = await obterConfiguracaoComercial();
  if (!configuracao.indicacao.ativo) return INVALIDO;
  const perfil = await prisma.perfilCliente.findUnique({
    where: { codigoIndicacao: codigo },
    select: { nomeLoja: true, conta: { select: { name: true, bloqueadoEm: true } } },
  });
  if (!perfil || perfil.conta.bloqueadoEm) return INVALIDO;
  return {
    valido: true,
    codigo,
    convidadoPor: perfil.nomeLoja?.trim().slice(0, 60) || primeiroNome(perfil.conta.name),
    bonusPerguntasIa: configuracao.indicacao.bonusIndicado.perguntasIa,
    diasTesteExtra: configuracao.indicacao.bonusIndicado.diasTesteExtra,
  };
}

export class CodigoIndicacaoError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "CodigoIndicacaoError";
  }
}

export async function motivoParaNaoInformarCodigo(
  usuario: { id: string; contaId: string },
  agora: Date = new Date()
): Promise<string | null> {
  if (usuario.id !== usuario.contaId) return "Só quem criou a conta da loja pode informar o código de indicação.";
  const [conta, indicacao, assinatura, pagamentos] = await Promise.all([
    prisma.user.findUnique({ where: { id: usuario.contaId }, select: { createdAt: true } }),
    prisma.indicacao.findUnique({ where: { indicadoContaId: usuario.contaId }, select: { id: true } }),
    prisma.subscription.findUnique({ where: { userId: usuario.contaId }, select: { status: true } }),
    prisma.pagamentoPlataforma.count({ where: { contaId: usuario.contaId, tipo: "ASSINATURA", aprovadoEm: { not: null } } }),
  ]);
  if (indicacao) return "Sua loja já entrou por uma indicação.";
  if (!conta || agora.getTime() - conta.createdAt.getTime() > PRAZO_CODIGO_DEPOIS_DIAS * DIA_MS) {
    return `O código só pode ser informado nos primeiros ${PRAZO_CODIGO_DEPOIS_DIAS} dias da conta.`;
  }
  if (assinatura?.status === "ACTIVE" || pagamentos > 0) return "O código precisa ser informado antes do primeiro pagamento.";
  return null;
}

export async function informarCodigoDepois(
  usuario: { id: string; contaId: string },
  codigoBruto: string,
  agora: Date = new Date()
): Promise<{ convidadoPor: string | null; bonusPerguntasIa: number }> {
  const motivo = await motivoParaNaoInformarCodigo(usuario, agora);
  if (motivo) throw new CodigoIndicacaoError(motivo);
  const convite = await consultarConvite(codigoBruto);
  if (!convite.valido || !convite.codigo) throw new CodigoIndicacaoError("Código não encontrado. Confira com quem indicou.");
  const proprio = await prisma.perfilCliente.findUnique({ where: { contaId: usuario.contaId }, select: { codigoIndicacao: true } });
  if (proprio?.codigoIndicacao === convite.codigo) throw new CodigoIndicacaoError("Esse é o código da sua própria loja.");
  const indicacao = await registrarIndicacaoNoCadastro(usuario.contaId, convite.codigo, agora);
  if (!indicacao) throw new CodigoIndicacaoError("Não foi possível registrar a indicação agora. Tente de novo.");
  return { convidadoPor: convite.convidadoPor, bonusPerguntasIa: convite.bonusPerguntasIa };
}
