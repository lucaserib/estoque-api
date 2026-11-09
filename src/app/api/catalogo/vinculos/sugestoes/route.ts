import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { sugerirVinculos } from "@/modules/catalogo/sugestoes";
import { permissaoErrorResponse } from "@/lib/permissoes";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUserAtivo(request);
    const sugestoes = await sugerirVinculos(user.contaId);
    return NextResponse.json({ sugestoes });
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    console.error("[CATALOGO_VINCULOS_SUGESTOES] Erro:", error);
    return NextResponse.json({ error: "Erro ao calcular sugestões de vínculo" }, { status: 500 });
  }
}
