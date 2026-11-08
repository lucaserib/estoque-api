import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { gerarDiagnostico } from "@/modules/controle/diagnostico";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const forcar = new URL(request.url).searchParams.get("atualizar") === "1";
    return NextResponse.json(await gerarDiagnostico(user.contaId, forcar));
  } catch (error) {
    if (error instanceof Error && error.message.includes("não autorizado")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    console.error("[DIAGNOSTICO] Erro ao gerar diagnóstico:", error);
    return NextResponse.json({ error: "Erro ao gerar o diagnóstico" }, { status: 500 });
  }
}
