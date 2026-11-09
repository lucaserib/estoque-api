import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { permissaoErrorResponse } from "@/lib/permissoes";
import { contextoDoUsuario } from "@/modules/operacao/contexto";
import { respostaErroOperacao } from "@/modules/operacao/erros";
import { moverNaListaSchema } from "@/modules/operacao/dominio/esquemas";
import { moverColuna } from "@/modules/operacao/quadros";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const contexto = contextoDoUsuario(await verifyUserAtivo(request));
    const { id } = await params;
    const destino = moverNaListaSchema.parse(await request.json());
    return NextResponse.json({ colunas: await moverColuna(contexto, id, destino) });
  } catch (error) {
    return permissaoErrorResponse(error) ?? respostaErroOperacao(error, "mover coluna");
  }
}
