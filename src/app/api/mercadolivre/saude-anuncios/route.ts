import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { withCache, createCacheKey } from "@/lib/cache";
import { calcularSaudeAnuncios } from "@/services/saudeAnunciosService";
import { permissaoErrorResponse } from "@/lib/permissoes";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUserAtivo(request);

    const resultado = await withCache(
      createCacheKey("saude-anuncios", user.contaId),
      () => calcularSaudeAnuncios(user.contaId),
      "pendencias"
    );

    return NextResponse.json(resultado);
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    console.error("Erro ao calcular saúde dos anúncios:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
