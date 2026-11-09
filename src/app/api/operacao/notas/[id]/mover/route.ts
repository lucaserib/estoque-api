import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { permissaoErrorResponse } from "@/lib/permissoes";
import { contextoDoUsuario } from "@/modules/operacao/contexto";
import { respostaErroOperacao } from "@/modules/operacao/erros";
import { moverNaListaSchema } from "@/modules/operacao/dominio/esquemas";
import { moverNota } from "@/modules/operacao/notas";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const contexto = contextoDoUsuario(await verifyUserAtivo(request));
    const { id } = await params;
    const destino = moverNaListaSchema.parse(await request.json());
    return NextResponse.json({ nota: await moverNota(contexto, id, destino) });
  } catch (error) {
    return permissaoErrorResponse(error) ?? respostaErroOperacao(error, "mover nota");
  }
}
