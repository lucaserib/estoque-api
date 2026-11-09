import { Prisma, type CategoriaEmail, type EmailEnviado, type StatusEmail } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { podeReceberCategoria, preferenciasDoUsuario } from "@/modules/clientes/consentimento";
import { mailtoDescadastro } from "./config";
import { categoriaDescadastroDe, linksDescadastro } from "./descadastro";
import { montarEmail, type EmailRenderizado } from "./layout";
import { MODELOS_EMAIL, obterModeloEmail, type ChaveModeloEmail, type DadosDoModelo } from "./modelos";
import { obterProvedorEmail, type MensagemEmail } from "./provedor";

export const MAX_TENTATIVAS_EMAIL = 3;

export interface PedidoEmail<C extends ChaveModeloEmail> {
  para: string;
  modelo: C;
  dados: DadosDoModelo<C>;
  chaveIdempotencia: string;
  categoria?: CategoriaEmail;
  contaId?: string | null;
  userId?: string | null;
  campanhaId?: string | null;
  urgente?: boolean;
}

export interface ResultadoEmail {
  id: string;
  status: StatusEmail;
  novo: boolean;
}

export function normalizarDestinatario(email: string): string {
  return email.trim().toLowerCase();
}

export async function motivoDeBloqueio(
  email: string,
  userId: string | null | undefined,
  categoria: CategoriaEmail
): Promise<string | null> {
  const supressao = await prisma.supressaoEmail.findUnique({ where: { email } });
  if (supressao && supressao.motivo !== "DESCADASTRO_TOTAL") return `Endereço suprimido (${supressao.motivo})`;
  if (categoria === "TRANSACIONAL") return null;
  if (supressao) return "Pessoa pediu para não receber estes e-mails";
  if (!userId) return "Sem usuário para conferir o consentimento";
  const preferencias = await preferenciasDoUsuario(userId);
  if (!podeReceberCategoria(preferencias, categoria)) {
    return categoria === "MARKETING" ? "Sem consentimento de marketing" : "Pessoa saiu dos e-mails do ciclo de vida";
  }
  return null;
}

export function renderizarEmail(
  registro: Pick<EmailEnviado, "modelo" | "categoria" | "userId" | "para" | "chaveIdempotencia" | "campanhaId">,
  dados: unknown
): { mensagem: MensagemEmail; renderizado: EmailRenderizado } {
  const modelo = obterModeloEmail(registro.modelo);
  if (!modelo) throw new Error(`Modelo de e-mail desconhecido: ${registro.modelo}`);
  const categoriaDescadastro = categoriaDescadastroDe(registro.categoria);
  const links = categoriaDescadastro && registro.userId ? linksDescadastro(registro.userId, categoriaDescadastro) : null;
  const renderizado = montarEmail(modelo.montar(dados as Record<string, unknown>), {
    categoria: registro.categoria,
    linkDescadastro: links?.pagina ?? null,
  });

  const cabecalhos: Record<string, string> = {};
  if (links) {
    const mailto = mailtoDescadastro();
    cabecalhos["List-Unsubscribe"] = [`<${links.umClique}>`, mailto ? `<${mailto}>` : null].filter(Boolean).join(", ");
    cabecalhos["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  return {
    renderizado,
    mensagem: {
      para: registro.para,
      assunto: renderizado.assunto,
      html: renderizado.html,
      texto: renderizado.texto,
      cabecalhos,
      chaveIdempotencia: registro.chaveIdempotencia.slice(0, 256),
      etiquetas: {
        modelo: registro.modelo,
        categoria: registro.categoria,
        ...(registro.campanhaId ? { campanha: registro.campanhaId } : {}),
      },
    },
  };
}

async function registrarResultado(id: string, tentativas: number, resultado: { id: string | null; erro: string | null }) {
  if (!resultado.erro && resultado.id) {
    return prisma.emailEnviado.update({
      where: { id },
      data: { status: "ENVIADO", provedorId: resultado.id, enviadoEm: new Date(), erro: null, dados: Prisma.DbNull },
    });
  }
  const desistir = tentativas >= MAX_TENTATIVAS_EMAIL;
  return prisma.emailEnviado.update({
    where: { id },
    data: { status: desistir ? "FALHOU" : "ENFILEIRADO", erro: (resultado.erro ?? "Falha desconhecida").slice(0, 1000) },
  });
}

export async function despacharEmail(registro: EmailEnviado, dados: unknown): Promise<StatusEmail> {
  const reservado = await prisma.emailEnviado.updateMany({
    where: { id: registro.id, status: "ENFILEIRADO" },
    data: { status: "ENVIADO", tentativas: { increment: 1 } },
  });
  if (reservado.count === 0) return registro.status;
  const tentativas = registro.tentativas + 1;

  let mensagem: MensagemEmail;
  try {
    mensagem = renderizarEmail(registro, dados).mensagem;
  } catch (error) {
    await prisma.emailEnviado.update({
      where: { id: registro.id },
      data: { status: "FALHOU", erro: error instanceof Error ? error.message.slice(0, 1000) : "Falha ao montar o e-mail" },
    });
    return "FALHOU";
  }

  try {
    const resultado = await obterProvedorEmail().enviar(mensagem);
    return (await registrarResultado(registro.id, tentativas, resultado)).status;
  } catch (error) {
    const atualizado = await registrarResultado(registro.id, tentativas, {
      id: null,
      erro: error instanceof Error ? error.message : "Falha ao enviar",
    });
    return atualizado.status;
  }
}

export async function enviarEmail<C extends ChaveModeloEmail>(pedido: PedidoEmail<C>): Promise<ResultadoEmail> {
  const modelo = MODELOS_EMAIL[pedido.modelo];
  const categoria = pedido.categoria ?? modelo.categoria;
  const para = normalizarDestinatario(pedido.para);
  const urgente = pedido.urgente ?? modelo.urgente;

  const existente = await prisma.emailEnviado.findUnique({ where: { chaveIdempotencia: pedido.chaveIdempotencia } });
  if (existente) return { id: existente.id, status: existente.status, novo: false };

  const bloqueio = await motivoDeBloqueio(para, pedido.userId, categoria);

  let registro: EmailEnviado;
  try {
    registro = await prisma.emailEnviado.create({
      data: {
        para,
        modelo: pedido.modelo,
        categoria,
        chaveIdempotencia: pedido.chaveIdempotencia,
        contaId: pedido.contaId ?? null,
        userId: pedido.userId ?? null,
        campanhaId: pedido.campanhaId ?? null,
        status: bloqueio ? "SUPRIMIDO" : "ENFILEIRADO",
        erro: bloqueio,
        dados: urgente || bloqueio ? Prisma.DbNull : (pedido.dados as Prisma.InputJsonValue),
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const corrente = await prisma.emailEnviado.findUnique({ where: { chaveIdempotencia: pedido.chaveIdempotencia } });
      if (corrente) return { id: corrente.id, status: corrente.status, novo: false };
    }
    throw error;
  }

  if (bloqueio || !urgente) return { id: registro.id, status: registro.status, novo: true };
  const status = await despacharEmail(registro, pedido.dados);
  return { id: registro.id, status, novo: true };
}

export async function enviarEmailSemFalhar<C extends ChaveModeloEmail>(pedido: PedidoEmail<C>): Promise<ResultadoEmail | null> {
  try {
    return await enviarEmail(pedido);
  } catch (error) {
    console.error(`[EMAIL] Falha ao enviar ${pedido.modelo}:`, error);
    return null;
  }
}
