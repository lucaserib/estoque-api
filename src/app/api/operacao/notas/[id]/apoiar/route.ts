import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { permissaoErrorResponse } from "@/lib/permissoes";
import { contextoDoUsuario } from "@/modules/operacao/contexto";
import { respostaErroOperacao } from "@/modules/operacao/erros";
import { apoiarNota } from "@/modules/operacao/notas";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const contexto = contextoDoUsuario(await verifyUserAtivo(request));
    const { id } = await params;
    return NextResponse.json({ nota: await apoiarNota(contexto, id) });
  } catch (error) {
    return permissaoErrorResponse(error) ?? respostaErroOperacao(error, "apoiar nota");
  }
}
