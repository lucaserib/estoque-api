import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { permissaoErrorResponse } from "@/lib/permissoes";
import { contextoDoUsuario } from "@/modules/operacao/contexto";
import { respostaErroOperacao } from "@/modules/operacao/erros";
import { atualizarTarefaSchema } from "@/modules/operacao/dominio/esquemas";
import { atualizarTarefa, detalharTarefa, excluirTarefa } from "@/modules/operacao/tarefas";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const contexto = contextoDoUsuario(await verifyUserAtivo(request));
    const { id } = await params;
    return NextResponse.json({ tarefa: await detalharTarefa(contexto, id) });
  } catch (error) {
    return permissaoErrorResponse(error) ?? respostaErroOperacao(error, "detalhar tarefa");
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const contexto = contextoDoUsuario(await verifyUserAtivo(request));
    const { id } = await params;
    const entrada = atualizarTarefaSchema.parse(await request.json());
    return NextResponse.json({ tarefa: await atualizarTarefa(contexto, id, entrada) });
  } catch (error) {
    return permissaoErrorResponse(error) ?? respostaErroOperacao(error, "atualizar tarefa");
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const contexto = contextoDoUsuario(await verifyUserAtivo(request));
    const { id } = await params;
    await excluirTarefa(contexto, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return permissaoErrorResponse(error) ?? respostaErroOperacao(error, "excluir tarefa");
  }
}
