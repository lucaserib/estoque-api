import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { permissaoErrorResponse } from "@/lib/permissoes";
import { contextoDoUsuario } from "@/modules/operacao/contexto";
import { respostaErroOperacao } from "@/modules/operacao/erros";
import { acaoTarefaSchema } from "@/modules/operacao/dominio/esquemas";
import { executarAcao } from "@/modules/operacao/tarefas";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const contexto = contextoDoUsuario(await verifyUserAtivo(request));
    const { id } = await params;
    const { acao } = acaoTarefaSchema.parse(await request.json());
    return NextResponse.json(await executarAcao(contexto, id, acao));
  } catch (error) {
    return permissaoErrorResponse(error) ?? respostaErroOperacao(error, "ação na tarefa");
  }
}
