import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { permissaoErrorResponse } from "@/lib/permissoes";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { CodigoIndicacaoError, informarCodigoDepois } from "@/modules/indicacao/convite";

const corpoSchema = z.object({ codigo: z.string().trim().min(3).max(20) });

export async function POST(request: NextRequest) {
  try {
    const usuario = await verifyUserAtivo(request);
    const limite = await checkRateLimit("codigo-indicacao", usuario.id, 10, 3600);
    if (!limite.allowed) return rateLimitResponse(limite);
    const corpo = corpoSchema.safeParse(await request.json().catch(() => null));
    if (!corpo.success) return NextResponse.json({ error: "Digite o código de indicação." }, { status: 400 });
    const resultado = await informarCodigoDepois({ id: usuario.id, contaId: usuario.contaId }, corpo.data.codigo);
    return NextResponse.json(resultado);
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    if (error instanceof CodigoIndicacaoError) return NextResponse.json({ error: error.message }, { status: 422 });
    console.error("[INDICACAO] Falha ao informar o código:", error);
    return NextResponse.json({ error: "Não foi possível registrar o código agora." }, { status: 500 });
  }
}
