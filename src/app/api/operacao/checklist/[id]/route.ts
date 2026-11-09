import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { permissaoErrorResponse } from "@/lib/permissoes";
import { contextoDoUsuario } from "@/modules/operacao/contexto";
import { respostaErroOperacao } from "@/modules/operacao/erros";
import { apagarItem, atualizarItem } from "@/modules/operacao/checklist";
import { atualizarItemChecklistSchema } from "@/modules/operacao/dominio/esquemas";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const contexto = contextoDoUsuario(await verifyUserAtivo(request));
    const { id } = await params;
    const dados = atualizarItemChecklistSchema.parse(await request.json());
    return NextResponse.json({ item: await atualizarItem(contexto, id, dados) });
  } catch (error) {
    return permissaoErrorResponse(error) ?? respostaErroOperacao(error, "atualizar item");
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const contexto = contextoDoUsuario(await verifyUserAtivo(request));
    const { id } = await params;
    await apagarItem(contexto, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return permissaoErrorResponse(error) ?? respostaErroOperacao(error, "apagar item");
  }
}
