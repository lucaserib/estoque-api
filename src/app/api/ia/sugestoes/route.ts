import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { gerarDiagnostico } from "@/modules/controle/diagnostico";
import { respostaErroRotaIa } from "@/modules/ia/respostas";
import { sugestoesParaPagina } from "@/modules/ia/sugestoes";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const pagina = request.nextUrl.searchParams.get("pagina");
    const diagnostico = await gerarDiagnostico(user.contaId).catch(() => null);
    return NextResponse.json(
      { sugestoes: sugestoesParaPagina(pagina, user.role, diagnostico?.itens ?? []) },
      { headers: { "Cache-Control": "private, max-age=60" } }
    );
  } catch (error) {
    return respostaErroRotaIa(error, "Falha ao montar sugestões");
  }
}
