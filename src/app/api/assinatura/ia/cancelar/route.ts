import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { exigirPermissao } from "@/lib/permissoes";
import { cancelarIa } from "@/modules/ia/cobranca";
import { respostaErroCobrancaIa } from "@/modules/ia/respostasCobranca";

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "INTEGRACOES_USUARIOS_ASSINATURA");
    const assinatura = await cancelarIa(user.contaId);
    return NextResponse.json({
      status: assinatura.iaStatus,
      acessoAte: assinatura.iaPeriodoFim?.toISOString() ?? null,
    });
  } catch (error) {
    return respostaErroCobrancaIa(error, "Falha ao cancelar o Skubo IA");
  }
}
