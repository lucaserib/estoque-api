import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { ehAdminPlataforma } from "@/lib/adminPlataforma";
import { PRICING } from "@/lib/billing";
import { podeEditar } from "@/lib/permissoes";
import { isMercadoPagoConfigured } from "@/services/mercadoPagoService";
import { obterAcessoIa } from "@/modules/ia/acesso";
import { respostaErroRotaIa } from "@/modules/ia/respostas";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const acesso = await obterAcessoIa(user.contaId);
    return NextResponse.json({
      ...acesso,
      adminPlataforma: ehAdminPlataforma(user.email),
      podeAssinar: podeEditar(user.role, "INTEGRACOES_USUARIOS_ASSINATURA"),
      pagamentoConfigurado: isMercadoPagoConfigured(),
      precoMensal: PRICING.IA_MENSAL,
    });
  } catch (error) {
    return respostaErroRotaIa(error, "Falha ao obter acesso à IA");
  }
}
