import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { permissaoErrorResponse } from "@/lib/permissoes";
import { contextoDoUsuario } from "@/modules/operacao/contexto";
import { respostaErroOperacao } from "@/modules/operacao/erros";
import { atualizarEtiquetaSchema } from "@/modules/operacao/dominio/esquemas";
import { apagarEtiqueta, atualizarEtiqueta } from "@/modules/operacao/quadros";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const contexto = contextoDoUsuario(await verifyUserAtivo(request));
    const { id } = await params;
    const dados = atualizarEtiquetaSchema.parse(await request.json());
    return NextResponse.json({ etiqueta: await atualizarEtiqueta(contexto, id, dados) });
  } catch (error) {
    return permissaoErrorResponse(error) ?? respostaErroOperacao(error, "atualizar etiqueta");
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const contexto = contextoDoUsuario(await verifyUserAtivo(request));
    const { id } = await params;
    await apagarEtiqueta(contexto, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return permissaoErrorResponse(error) ?? respostaErroOperacao(error, "apagar etiqueta");
  }
}
