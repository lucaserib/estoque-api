import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { permissaoErrorResponse } from "@/lib/permissoes";
import { ipDe } from "@/modules/conta/auditoria";
import { enviarConfirmacaoDeEmail } from "@/modules/usuarios/senha";

export async function POST(request: NextRequest) {
  try {
    const usuario = await verifyUser(request);
    if (usuario.emailVerificadoEm) return NextResponse.json({ jaConfirmado: true });

    const limite = await checkRateLimit("email-reenviar", usuario.id, 3, 3600);
    if (!limite.allowed) return rateLimitResponse(limite);

    await enviarConfirmacaoDeEmail(usuario.id, ipDe(request.headers));
    return NextResponse.json({ mensagem: `Mandamos um novo link para ${usuario.email}.` });
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    if (error instanceof Error && /não autorizado|não encontrado/i.test(error.message)) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    console.error("[EMAIL] Falha ao reenviar confirmação:", error);
    return NextResponse.json({ error: "Não foi possível reenviar agora." }, { status: 500 });
  }
}
