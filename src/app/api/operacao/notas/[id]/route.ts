import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { permissaoErrorResponse } from "@/lib/permissoes";
import { contextoDoUsuario } from "@/modules/operacao/contexto";
import { respostaErroOperacao } from "@/modules/operacao/erros";
import { atualizarNotaSchema } from "@/modules/operacao/dominio/esquemas";
import { apagarNota, atualizarNota } from "@/modules/operacao/notas";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const contexto = contextoDoUsuario(await verifyUserAtivo(request));
    const { id } = await params;
    const dados = atualizarNotaSchema.parse(await request.json());
    return NextResponse.json({ nota: await atualizarNota(contexto, id, dados) });
  } catch (error) {
    return permissaoErrorResponse(error) ?? respostaErroOperacao(error, "atualizar nota");
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const contexto = contextoDoUsuario(await verifyUserAtivo(request));
    const { id } = await params;
    await apagarNota(contexto, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return permissaoErrorResponse(error) ?? respostaErroOperacao(error, "apagar nota");
  }
}
