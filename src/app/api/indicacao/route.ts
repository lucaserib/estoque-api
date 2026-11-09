import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { permissaoErrorResponse } from "@/lib/permissoes";
import { painelIndicacao } from "@/modules/indicacao/painel";

export async function GET(request: NextRequest) {
  try {
    const usuario = await verifyUser(request);
    const painel = await painelIndicacao(usuario.contaId, usuario.id);
    return NextResponse.json({ ...painel, emailVerificado: Boolean(usuario.emailVerificadoEm) });
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    console.error("[INDICACAO] Falha ao montar o painel:", error);
    return NextResponse.json({ error: "Não foi possível carregar suas indicações agora." }, { status: 500 });
  }
}
