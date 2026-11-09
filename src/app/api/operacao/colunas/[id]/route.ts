import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { permissaoErrorResponse } from "@/lib/permissoes";
import { contextoDoUsuario } from "@/modules/operacao/contexto";
import { respostaErroOperacao } from "@/modules/operacao/erros";
import { apagarColunaSchema, atualizarColunaSchema } from "@/modules/operacao/dominio/esquemas";
import { apagarColuna, atualizarColuna } from "@/modules/operacao/quadros";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const contexto = contextoDoUsuario(await verifyUserAtivo(request));
    const { id } = await params;
    const dados = atualizarColunaSchema.parse(await request.json());
    return NextResponse.json({ coluna: await atualizarColuna(contexto, id, dados) });
  } catch (error) {
    return permissaoErrorResponse(error) ?? respostaErroOperacao(error, "atualizar coluna");
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const contexto = contextoDoUsuario(await verifyUserAtivo(request));
    const { id } = await params;
    const { destinoId } = apagarColunaSchema.parse({ destinoId: request.nextUrl.searchParams.get("destino") });
    await apagarColuna(contexto, id, destinoId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return permissaoErrorResponse(error) ?? respostaErroOperacao(error, "apagar coluna");
  }
}
