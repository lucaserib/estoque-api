import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { ehAdminPlataforma } from "@/lib/adminPlataforma";
import { isMercadoPagoConfigured } from "@/services/mercadoPagoService";
import { obterAcessoIa } from "@/modules/ia/acesso";
import { respostaErroRotaIa } from "@/modules/ia/respostas";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUserAtivo(request);
    const acesso = await obterAcessoIa(user.contaId);
    return NextResponse.json({
      ...acesso,
      adminPlataforma: ehAdminPlataforma(user.email),
      emailVerificado: Boolean(user.emailVerificadoEm),
      pagamentoConfigurado: isMercadoPagoConfigured(),
    });
  } catch (error) {
    return respostaErroRotaIa(error, "Falha ao obter acesso à IA");
  }
}
