import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { exigirPermissao, permissaoErrorResponse } from "@/lib/permissoes";
import {
  atualizarCategoria,
  excluirCategoria,
  CategoriaNaoEncontradaError,
  CategoriaSistemaNaoPodeSerExcluidaError,
} from "@/modules/financeiro/lancamentos/categorias";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "FINANCEIRO_EDITAR");
    const { id } = await params;

    const body = await request.json();
    const categoria = await atualizarCategoria(user.contaId, id, body);
    return NextResponse.json(categoria);
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;
    if (error instanceof CategoriaNaoEncontradaError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error("Erro ao atualizar categoria:", error);
    return NextResponse.json({ error: "Erro ao atualizar categoria" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "FINANCEIRO_EDITAR");
    const { id } = await params;

    await excluirCategoria(user.contaId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;
    if (error instanceof CategoriaNaoEncontradaError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof CategoriaSistemaNaoPodeSerExcluidaError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("Erro ao excluir categoria:", error);
    return NextResponse.json({ error: "Erro ao excluir categoria" }, { status: 500 });
  }
}
