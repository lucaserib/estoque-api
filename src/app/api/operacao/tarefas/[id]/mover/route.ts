import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { permissaoErrorResponse } from "@/lib/permissoes";
import { contextoDoUsuario } from "@/modules/operacao/contexto";
import { respostaErroOperacao } from "@/modules/operacao/erros";
import { moverSchema } from "@/modules/operacao/dominio/esquemas";
import { moverTarefa } from "@/modules/operacao/tarefas";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const contexto = contextoDoUsuario(await verifyUserAtivo(request));
    const { id } = await params;
    const destino = moverSchema.parse(await request.json());
    return NextResponse.json(await moverTarefa(contexto, id, destino));
  } catch (error) {
    return permissaoErrorResponse(error) ?? respostaErroOperacao(error, "mover tarefa");
  }
}
