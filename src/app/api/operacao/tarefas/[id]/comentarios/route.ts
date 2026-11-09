import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { permissaoErrorResponse } from "@/lib/permissoes";
import { contextoDoUsuario } from "@/modules/operacao/contexto";
import { respostaErroOperacao } from "@/modules/operacao/erros";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { comentar } from "@/modules/operacao/comentarios";
import { comentarioSchema } from "@/modules/operacao/dominio/esquemas";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const contexto = contextoDoUsuario(await verifyUserAtivo(request));
    const limite = await checkRateLimit("operacao-comentario", contexto.userId, 60, 600);
    if (!limite.allowed) return rateLimitResponse(limite);
    const { id } = await params;
    const { corpo } = comentarioSchema.parse(await request.json());
    return NextResponse.json({ comentario: await comentar(contexto, id, corpo) }, { status: 201 });
  } catch (error) {
    return permissaoErrorResponse(error) ?? respostaErroOperacao(error, "comentar");
  }
}
