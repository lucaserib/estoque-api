import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { permissaoErrorResponse } from "@/lib/permissoes";
import { obterSituacaoConta } from "@/modules/conta/situacao";
import { enviarEmailSemFalhar } from "@/modules/email/enviar";

function diaEmSaoPaulo(agora: Date): string {
  return agora.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export async function POST(request: NextRequest) {
  try {
    const usuario = await verifyUser(request);
    const situacao = await obterSituacaoConta(usuario.contaId);
    if (situacao.podeUsar) {
      return NextResponse.json({ error: "A assinatura da loja está ativa." }, { status: 400 });
    }

    const dia = diaEmSaoPaulo(new Date());
    const prefixo = `aviso-responsavel:${usuario.contaId}:${dia}:`;
    const jaAvisado = await prisma.emailEnviado.findFirst({
      where: { chaveIdempotencia: { startsWith: prefixo } },
      select: { id: true },
    });
    if (jaAvisado) {
      return NextResponse.json({ error: "O responsável já foi avisado hoje. Tente de novo amanhã." }, { status: 429 });
    }

    const [administradores, configuracao] = await Promise.all([
      prisma.user.findMany({
        where: { OR: [{ id: usuario.contaId }, { contaId: usuario.contaId, role: "ADMIN" }], NOT: { id: usuario.id } },
        select: { id: true, email: true },
      }),
      prisma.configuracaoGeral.findUnique({ where: { userId: usuario.contaId }, select: { nomeLoja: true } }),
    ]);

    for (const admin of administradores) {
      await prisma.notification.create({
        data: {
          userId: admin.id,
          type: "ASSINATURA",
          title: "Sua equipe está sem acesso",
          body: `${usuario.name ?? usuario.email} tentou usar o Skubo, mas a assinatura da loja não está ativa.`,
          link: "/assinatura",
        },
      });
      await enviarEmailSemFalhar({
        para: admin.email,
        modelo: "aviso-responsavel",
        dados: { nomeMembro: usuario.name, emailMembro: usuario.email, nomeLoja: configuracao?.nomeLoja ?? null },
        chaveIdempotencia: `${prefixo}${admin.id}`,
        userId: admin.id,
        contaId: usuario.contaId,
        urgente: true,
      });
    }

    return NextResponse.json({ avisados: administradores.length });
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    console.error("Erro ao avisar o responsável:", error);
    return NextResponse.json({ error: "Não foi possível avisar agora." }, { status: 500 });
  }
}
