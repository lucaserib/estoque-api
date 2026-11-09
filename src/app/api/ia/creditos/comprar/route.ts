import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyUser } from "@/helpers/verifyUser";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { permissaoErrorResponse } from "@/lib/permissoes";
import { CompraCreditosError, CupomInvalidoError, criarCompraCreditos } from "@/modules/ia/compraCreditos";

const corpoSchema = z.object({
  pacoteId: z.string().trim().min(1).max(40),
  cupom: z.string().trim().max(40).nullish(),
});

export async function POST(request: NextRequest) {
  try {
    const usuario = await verifyUser(request);
    const limite = await checkRateLimit("compra-creditos", usuario.id, 10, 3600);
    if (!limite.allowed) return rateLimitResponse(limite);

    const corpo = corpoSchema.safeParse(await request.json().catch(() => null));
    if (!corpo.success) return NextResponse.json({ error: "Escolha um pacote." }, { status: 400 });

    const { compra, checkoutUrl } = await criarCompraCreditos({
      usuario: { id: usuario.id, contaId: usuario.contaId, email: usuario.email, emailVerificadoEm: usuario.emailVerificadoEm },
      pacoteId: corpo.data.pacoteId,
      cupom: corpo.data.cupom,
    });
    return NextResponse.json({ compraId: compra.id, checkoutUrl, precoCentavos: compra.precoCentavos }, { status: 201 });
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    if (error instanceof CompraCreditosError) {
      return NextResponse.json({ error: error.message, codigo: error.codigo }, { status: error.status });
    }
    if (error instanceof CupomInvalidoError) {
      return NextResponse.json({ error: error.message, codigo: error.code }, { status: 400 });
    }
    console.error("[IA_CREDITOS] Falha ao abrir a compra:", error);
    return NextResponse.json({ error: "Não foi possível abrir o pagamento agora." }, { status: 500 });
  }
}
