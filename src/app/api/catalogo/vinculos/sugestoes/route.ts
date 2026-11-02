import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { sugerirVinculos } from "@/modules/catalogo/sugestoes";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const sugestoes = await sugerirVinculos(user.contaId);
    return NextResponse.json({ sugestoes });
  } catch (error) {
    console.error("[CATALOGO_VINCULOS_SUGESTOES] Erro:", error);
    return NextResponse.json({ error: "Erro ao calcular sugestões de vínculo" }, { status: 500 });
  }
}
