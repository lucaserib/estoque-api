import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { exigirPermissao } from "@/lib/permissoes";
import { isMercadoPagoConfigured } from "@/services/mercadoPagoService";
import { assinarIa } from "@/modules/ia/cobranca";
import { respostaErroCobrancaIa } from "@/modules/ia/respostasCobranca";

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "INTEGRACOES_USUARIOS_ASSINATURA");
    if (!isMercadoPagoConfigured()) {
      return NextResponse.json({ error: "Pagamentos ainda não estão configurados.", codigo: "MP_NAO_CONFIGURADO" }, { status: 503 });
    }
    return NextResponse.json(await assinarIa(user.contaId, user.email, request.nextUrl.origin));
  } catch (error) {
    return respostaErroCobrancaIa(error, "Falha ao assinar o Skubo IA");
  }
}
