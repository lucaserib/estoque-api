import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { permissaoErrorResponse } from "@/lib/permissoes";
import { obterAcessoIa } from "@/modules/ia/acesso";
import { extratoCreditos, resumoCreditos } from "@/modules/ia/creditos";
import { isMercadoPagoConfigured } from "@/services/mercadoPagoService";

export async function GET(request: NextRequest) {
  try {
    const usuario = await verifyUser(request);
    const pagina = Math.max(1, Number(request.nextUrl.searchParams.get("pagina")) || 1);
    const [acesso, resumo, extrato] = await Promise.all([
      obterAcessoIa(usuario.contaId),
      resumoCreditos(usuario.contaId),
      extratoCreditos(usuario.contaId, pagina, 20),
    ]);
    return NextResponse.json({
      saldo: resumo.saldo,
      ilimitada: acesso.ilimitada,
      proximoVencimento: resumo.proximoVencimento,
      lotes: resumo.lotes,
      extrato,
      pacotes: acesso.pacotes,
      podeComprar: Boolean(usuario.emailVerificadoEm) && acesso.contaAtiva,
      emailVerificado: Boolean(usuario.emailVerificadoEm),
      pagamentoConfigurado: isMercadoPagoConfigured(),
    });
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    console.error("[IA_CREDITOS] Falha ao listar créditos:", error);
    return NextResponse.json({ error: "Não foi possível carregar as perguntas agora." }, { status: 500 });
  }
}
