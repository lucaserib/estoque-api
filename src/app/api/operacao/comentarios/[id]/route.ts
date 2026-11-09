import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { permissaoErrorResponse } from "@/lib/permissoes";
import { contextoDoUsuario } from "@/modules/operacao/contexto";
import { respostaErroOperacao } from "@/modules/operacao/erros";
import { apagarComentario, editarComentario } from "@/modules/operacao/comentarios";
import { comentarioSchema } from "@/modules/operacao/dominio/esquemas";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const contexto = contextoDoUsuario(await verifyUserAtivo(request));
    const { id } = await params;
    const { corpo } = comentarioSchema.parse(await request.json());
    return NextResponse.json({ comentario: await editarComentario(contexto, id, corpo) });
  } catch (error) {
    return permissaoErrorResponse(error) ?? respostaErroOperacao(error, "editar comentário");
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const contexto = contextoDoUsuario(await verifyUserAtivo(request));
    const { id } = await params;
    await apagarComentario(contexto, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return permissaoErrorResponse(error) ?? respostaErroOperacao(error, "apagar comentário");
  }
}
