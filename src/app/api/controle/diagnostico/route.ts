import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { gerarDiagnostico } from "@/modules/controle/diagnostico";
import { permissaoErrorResponse } from "@/lib/permissoes";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUserAtivo(request);
    const forcar = new URL(request.url).searchParams.get("atualizar") === "1";
    return NextResponse.json(await gerarDiagnostico(user.contaId, forcar));
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    if (error instanceof Error && error.message.includes("não autorizado")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    console.error("[DIAGNOSTICO] Erro ao gerar diagnóstico:", error);
    return NextResponse.json({ error: "Erro ao gerar o diagnóstico" }, { status: 500 });
  }
}
