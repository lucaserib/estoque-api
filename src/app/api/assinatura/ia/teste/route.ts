import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { exigirPermissao } from "@/lib/permissoes";
import { iniciarTesteIa } from "@/modules/ia/cobranca";
import { respostaErroCobrancaIa } from "@/modules/ia/respostasCobranca";
import { obterAcessoIa } from "@/modules/ia/acesso";

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "INTEGRACOES_USUARIOS_ASSINATURA");
    await iniciarTesteIa(user.contaId);
    return NextResponse.json({ acesso: await obterAcessoIa(user.contaId) });
  } catch (error) {
    return respostaErroCobrancaIa(error, "Falha ao iniciar o teste do Skubo IA");
  }
}
