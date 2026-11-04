import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { withCache, createCacheKey } from "@/lib/cache";
import { calcularSaudeAnuncios } from "@/services/saudeAnunciosService";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);

    const resultado = await withCache(
      createCacheKey("saude-anuncios", user.contaId),
      () => calcularSaudeAnuncios(user.contaId),
      "pendencias"
    );

    return NextResponse.json(resultado);
  } catch (error) {
    console.error("Erro ao calcular saúde dos anúncios:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
